// js/roles.js - Sistema de roles y permisos para DOMKA Solutions

/**
 * JERARQUÍA DE ROLES:
 * - admin: Acceso total al sistema
 * - comercial: Cotizaciones, clientes, documentos, proyectos
 * - tecnico: Proyectos y documentos (solo lectura en clientes)
 * - cliente: Solo portal cliente
 */

const ROLES = {
  ADMIN: 'admin',
  COMERCIAL: 'comercial',
  TECNICO: 'tecnico',
  CLIENTE: 'cliente'
};

const ROLE_HIERARCHY = {
  admin: 4,
  comercial: 3,
  tecnico: 2,
  cliente: 1
};

// Módulos accesibles por rol
const MODULE_PERMISSIONS = {
  dashboard: ['admin', 'comercial', 'tecnico'],
  cotizaciones: ['admin', 'comercial'],
  clientes: ['admin', 'comercial'],
  proyectos: ['admin', 'comercial', 'tecnico'],
  documentos: ['admin', 'comercial', 'tecnico'],
  contabilidad: ['admin'],
  usuarios: ['admin']
};

// Estado global del usuario actual
let currentUserProfile = null;

/**
 * Inicializar el sistema de roles
 */
async function initRoleSystem() {
  return new Promise((resolve, reject) => {
    window.auth.onAuthStateChanged(async (user) => {
      if (!user) {
        currentUserProfile = null;
        resolve(null);
        return;
      }

      try {
        // Obtener perfil del usuario desde Firestore
        const userDoc = await window.db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
          currentUserProfile = {
            uid: user.uid,
            email: user.email,
            ...userDoc.data()
          };
          
          // Actualizar UI con información del usuario
          updateUserUI();
          
          // Aplicar permisos de navegación
          applyNavigationPermissions();
          
          resolve(currentUserProfile);
        } else {
          // Usuario sin perfil en Firestore - crear perfil básico
          console.warn('Usuario sin perfil en Firestore, creando perfil básico...');
          
          const basicProfile = {
            email: user.email,
            role: 'tecnico', // Rol por defecto
            createdAt: new Date().toISOString(),
            nombre: user.email.split('@')[0]
          };
          
          await window.db.collection('users').doc(user.uid).set(basicProfile);
          
          currentUserProfile = {
            uid: user.uid,
            ...basicProfile
          };
          
          updateUserUI();
          applyNavigationPermissions();
          
          resolve(currentUserProfile);
        }
      } catch (error) {
        console.error('Error al obtener perfil de usuario:', error);
        reject(error);
      }
    });
  });
}

/**
 * Obtener el rol del usuario actual
 */
function getCurrentRole() {
  return currentUserProfile?.role || null;
}

/**
 * Obtener perfil completo del usuario actual
 */
function getCurrentUserProfile() {
  return currentUserProfile;
}

/**
 * Verificar si el usuario tiene un rol específico
 */
function hasRole(role) {
  const currentRole = getCurrentRole();
  if (!currentRole) return false;
  return currentRole === role;
}

/**
 * Verificar si el usuario tiene al menos el nivel de un rol
 */
function hasMinRole(minRole) {
  const currentRole = getCurrentRole();
  if (!currentRole) return false;
  
  const currentLevel = ROLE_HIERARCHY[currentRole] || 0;
  const minLevel = ROLE_HIERARCHY[minRole] || 0;
  
  return currentLevel >= minLevel;
}

/**
 * Verificar si el usuario puede acceder a un módulo
 */
function canAccessModule(moduleName) {
  const currentRole = getCurrentRole();
  if (!currentRole) return false;
  
  const allowedRoles = MODULE_PERMISSIONS[moduleName];
  if (!allowedRoles) return false;
  
  return allowedRoles.includes(currentRole);
}

/**
 * Aplicar permisos a la navegación
 */
function applyNavigationPermissions() {
  const currentRole = getCurrentRole();
  if (!currentRole) return;
  
  // Obtener todos los elementos de navegación con restricción de rol
  const navItems = document.querySelectorAll('[data-rol-min]');
  
  navItems.forEach(item => {
    const minRole = item.getAttribute('data-rol-min');
    
    if (hasMinRole(minRole)) {
      item.style.display = ''; // Mostrar
      item.classList.remove('nav-disabled');
    } else {
      item.style.display = 'none'; // Ocultar
      item.classList.add('nav-disabled');
    }
  });
  
  // Verificar acceso a la página actual
  checkPageAccess();
}

/**
 * Verificar si el usuario puede acceder a la página actual
 */
function checkPageAccess() {
  const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
  
  // Páginas públicas
  const publicPages = ['index', 'home', '', 'cotizacion'];
  if (publicPages.includes(currentPage)) return;
  
  // Portal cliente
  if (window.location.pathname.includes('/cliente/')) {
    if (!hasRole(ROLES.CLIENTE) && !hasMinRole(ROLES.ADMIN)) {
      console.warn('Acceso denegado al portal cliente');
      window.location.href = '../dashboard.html';
    }
    return;
  }
  
  // Verificar acceso al módulo
  if (!canAccessModule(currentPage)) {
    console.warn(`Acceso denegado al módulo: ${currentPage}`);
    alert('No tienes permisos para acceder a esta sección');
    window.location.href = 'dashboard.html';
  }
}

/**
 * Actualizar UI con información del usuario
 */
function updateUserUI() {
  if (!currentUserProfile) return;
  
  // Actualizar email
  const emailElements = document.querySelectorAll('#user-email, [data-user-email]');
  emailElements.forEach(el => {
    el.textContent = currentUserProfile.email || 'Usuario';
  });
  
  // Actualizar nombre
  const nameElements = document.querySelectorAll('#user-name, [data-user-name]');
  nameElements.forEach(el => {
    el.textContent = currentUserProfile.nombre || currentUserProfile.email?.split('@')[0] || 'Usuario';
  });
  
  // Actualizar rol
  const roleElements = document.querySelectorAll('#user-rol, [data-user-role]');
  roleElements.forEach(el => {
    const roleName = getRoleName(currentUserProfile.role);
    el.textContent = roleName;
    
    // Agregar badge de color según rol
    el.className = `role-badge role-${currentUserProfile.role}`;
  });
}

/**
 * Obtener nombre legible del rol
 */
function getRoleName(role) {
  const roleNames = {
    admin: 'Administrador',
    comercial: 'Comercial',
    tecnico: 'Técnico',
    cliente: 'Cliente'
  };
  return roleNames[role] || role;
}

/**
 * Verificar si el usuario puede realizar una acción
 */
function canPerformAction(action, resourceType) {
  const currentRole = getCurrentRole();
  if (!currentRole) return false;
  
  // Admin puede hacer todo
  if (currentRole === ROLES.ADMIN) return true;
  
  // Permisos específicos por tipo de recurso
  const actionPermissions = {
    // Cotizaciones
    cotizaciones: {
      create: ['admin', 'comercial'],
      read: ['admin', 'comercial', 'tecnico'],
      update: ['admin', 'comercial'],
      delete: ['admin', 'comercial']
    },
    // Clientes
    clientes: {
      create: ['admin', 'comercial'],
      read: ['admin', 'comercial', 'tecnico'],
      update: ['admin', 'comercial'],
      delete: ['admin', 'comercial']
    },
    // Proyectos
    proyectos: {
      create: ['admin', 'comercial'],
      read: ['admin', 'comercial', 'tecnico'],
      update: ['admin', 'comercial', 'tecnico'],
      delete: ['admin', 'comercial']
    },
    // Documentos
    documentos: {
      create: ['admin', 'comercial'],
      read: ['admin', 'comercial', 'tecnico'],
      update: ['admin', 'comercial'],
      delete: ['admin', 'comercial']
    },
    // Usuarios
    usuarios: {
      create: ['admin'],
      read: ['admin'],
      update: ['admin'],
      delete: ['admin']
    },
    // Contabilidad
    contabilidad: {
      create: ['admin'],
      read: ['admin'],
      update: ['admin'],
      delete: ['admin']
    }
  };
  
  const permissions = actionPermissions[resourceType];
  if (!permissions || !permissions[action]) return false;
  
  return permissions[action].includes(currentRole);
}

/**
 * Mostrar/ocultar elementos según permisos
 */
function toggleElementsByPermission(action, resourceType) {
  const selector = `[data-permission="${action}-${resourceType}"]`;
  const elements = document.querySelectorAll(selector);
  
  elements.forEach(element => {
    if (canPerformAction(action, resourceType)) {
      element.style.display = '';
      element.disabled = false;
    } else {
      element.style.display = 'none';
      element.disabled = true;
    }
  });
}

/**
 * Crear badge de rol para UI
 */
function createRoleBadge(role) {
  const colors = {
    admin: '#dc2626',
    comercial: '#16a34a',
    tecnico: '#2563eb',
    cliente: '#9333ea'
  };
  
  return `<span style="
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    background: ${colors[role] || '#6b7280'};
    color: white;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  ">${getRoleName(role)}</span>`;
}

// Exponer funciones globalmente
window.roleSystem = {
  init: initRoleSystem,
  getCurrentRole,
  getCurrentUserProfile,
  hasRole,
  hasMinRole,
  canAccessModule,
  canPerformAction,
  applyNavigationPermissions,
  toggleElementsByPermission,
  createRoleBadge,
  getRoleName,
  ROLES,
  MODULE_PERMISSIONS
};

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initRoleSystem().catch(console.error);
  });
} else {
  initRoleSystem().catch(console.error);
}
