// js/security.js - Sistema de seguridad y validaciones

/**
 * Validar y sanitizar texto de entrada
 */
function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  
  return String(value)
    .replace(/[<>]/g, '') // Eliminar HTML tags básicos
    .trim();
}

/**
 * Validar email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validar número de teléfono colombiano
 */
function isValidPhone(phone) {
  // Formato: +57 300 000 0000 o 3000000000
  const phoneRegex = /^(\+57\s?)?[3][0-9]{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Validar NIT colombiano
 */
function isValidNIT(nit) {
  // Formato básico: 000000000-0
  const nitRegex = /^[0-9]{9}-[0-9]$/;
  return nitRegex.test(nit);
}

/**
 * Sanitizar datos de formulario
 */
function sanitizeFormData(formData) {
  const sanitized = {};
  
  for (const key in formData) {
    if (formData.hasOwnProperty(key)) {
      const value = formData[key];
      
      // Si es string, sanitizar
      if (typeof value === 'string') {
        sanitized[key] = sanitizeText(value);
      } 
      // Si es número, validar
      else if (typeof value === 'number') {
        sanitized[key] = isNaN(value) ? 0 : value;
      }
      // Si es boolean, mantener
      else if (typeof value === 'boolean') {
        sanitized[key] = value;
      }
      // Si es objeto o array, mantener (cuidado con objetos complejos)
      else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

/**
 * Validar permisos antes de realizar operación en Firestore
 */
async function validatePermission(action, collection) {
  // Verificar que hay usuario autenticado
  const user = window.auth.currentUser;
  if (!user) {
    throw new Error('Usuario no autenticado');
  }
  
  // Verificar permisos con sistema de roles
  if (window.roleSystem && window.roleSystem.canPerformAction) {
    const hasPermission = window.roleSystem.canPerformAction(action, collection);
    
    if (!hasPermission) {
      throw new Error(`No tienes permisos para ${action} en ${collection}`);
    }
  }
  
  return true;
}

/**
 * Logger de actividad
 */
async function logActivity(action, details) {
  try {
    const user = window.auth.currentUser;
    if (!user) return;
    
    const logEntry = {
      action,
      details,
      userId: user.uid,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      ip: 'client-side' // En producción, esto vendría del servidor
    };
    
    await window.db.collection('logs').add(logEntry);
  } catch (error) {
    console.error('Error al registrar actividad:', error);
  }
}

/**
 * Validar datos antes de guardar en Firestore
 */
function validateDocumentData(collection, data) {
  const errors = [];
  
  // Validaciones por colección
  switch(collection) {
    case 'clientes':
      if (!data.nombre || data.nombre.trim() === '') {
        errors.push('El nombre del cliente es obligatorio');
      }
      if (!data.email || !isValidEmail(data.email)) {
        errors.push('Email inválido');
      }
      if (data.telefono && !isValidPhone(data.telefono)) {
        errors.push('Teléfono inválido (formato: +57 300 000 0000)');
      }
      if (data.nit && !isValidNIT(data.nit)) {
        errors.push('NIT inválido (formato: 000000000-0)');
      }
      break;
      
    case 'cotizaciones':
      if (!data.cliente || data.cliente.trim() === '') {
        errors.push('El cliente es obligatorio');
      }
      if (!data.items || data.items.length === 0) {
        errors.push('Debe haber al menos un item en la cotización');
      }
      if (!data.total || data.total <= 0) {
        errors.push('El total debe ser mayor a 0');
      }
      break;
      
    case 'proyectos':
      if (!data.nombre || data.nombre.trim() === '') {
        errors.push('El nombre del proyecto es obligatorio');
      }
      if (!data.cliente || data.cliente.trim() === '') {
        errors.push('El cliente es obligatorio');
      }
      break;
      
    case 'usuarios':
      if (!data.email || !isValidEmail(data.email)) {
        errors.push('Email inválido');
      }
      if (!data.role || !['admin', 'comercial', 'tecnico', 'cliente'].includes(data.role)) {
        errors.push('Rol inválido');
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Wrapper seguro para operaciones de Firestore
 */
const secureFirestore = {
  /**
   * Agregar documento con validación
   */
  async addDocument(collection, data) {
    // Validar permisos
    await validatePermission('create', collection);
    
    // Sanitizar datos
    const sanitizedData = sanitizeFormData(data);
    
    // Validar datos
    const validation = validateDocumentData(collection, sanitizedData);
    if (!validation.valid) {
      throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
    }
    
    // Agregar metadatos
    const dataWithMeta = {
      ...sanitizedData,
      createdAt: new Date().toISOString(),
      createdBy: window.auth.currentUser.uid,
      updatedAt: new Date().toISOString(),
      updatedBy: window.auth.currentUser.uid
    };
    
    // Guardar
    const result = await window.db.collection(collection).add(dataWithMeta);
    
    // Log
    await logActivity(`create_${collection}`, { id: result.id, data: sanitizedData });
    
    return result;
  },
  
  /**
   * Actualizar documento con validación
   */
  async updateDocument(collection, docId, data) {
    // Validar permisos
    await validatePermission('update', collection);
    
    // Sanitizar datos
    const sanitizedData = sanitizeFormData(data);
    
    // Validar datos
    const validation = validateDocumentData(collection, sanitizedData);
    if (!validation.valid) {
      throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
    }
    
    // Agregar metadatos
    const dataWithMeta = {
      ...sanitizedData,
      updatedAt: new Date().toISOString(),
      updatedBy: window.auth.currentUser.uid
    };
    
    // Actualizar
    await window.db.collection(collection).doc(docId).update(dataWithMeta);
    
    // Log
    await logActivity(`update_${collection}`, { id: docId, data: sanitizedData });
    
    return true;
  },
  
  /**
   * Eliminar documento con validación
   */
  async deleteDocument(collection, docId) {
    // Validar permisos
    await validatePermission('delete', collection);
    
    // Obtener datos antes de eliminar (para log)
    const doc = await window.db.collection(collection).doc(docId).get();
    const data = doc.exists ? doc.data() : null;
    
    // Eliminar
    await window.db.collection(collection).doc(docId).delete();
    
    // Log
    await logActivity(`delete_${collection}`, { id: docId, data });
    
    return true;
  },
  
  /**
   * Leer documento con validación de permisos
   */
  async getDocument(collection, docId) {
    // Validar permisos
    await validatePermission('read', collection);
    
    const doc = await window.db.collection(collection).doc(docId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return {
      id: doc.id,
      ...doc.data()
    };
  },
  
  /**
   * Listar documentos con validación de permisos
   */
  async listDocuments(collection, queryConstraints = []) {
    // Validar permisos
    await validatePermission('read', collection);
    
    let query = window.db.collection(collection);
    
    // Aplicar filtros si existen
    queryConstraints.forEach(constraint => {
      query = query.where(constraint.field, constraint.operator, constraint.value);
    });
    
    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
};

/**
 * Protección contra XSS en renderizado
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Formatear valores monetarios
 */
function formatCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '$0';
  
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Formatear fechas
 */
function formatDate(date) {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d);
}

/**
 * Validar sesión activa
 */
async function requireAuth() {
  return new Promise((resolve, reject) => {
    const unsubscribe = window.auth.onAuthStateChanged(user => {
      unsubscribe();
      
      if (!user) {
        reject(new Error('Sesión no activa'));
        window.location.href = 'home.html';
      } else {
        resolve(user);
      }
    });
  });
}

// Exponer funciones globalmente
window.security = {
  sanitizeText,
  sanitizeFormData,
  isValidEmail,
  isValidPhone,
  isValidNIT,
  validatePermission,
  validateDocumentData,
  logActivity,
  secureFirestore,
  escapeHtml,
  formatCurrency,
  formatDate,
  requireAuth
};
