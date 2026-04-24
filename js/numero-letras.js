// js/numero-letras.js
function numeroALetras(num) {
  const n = Number(num || 0);
  const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(n);
  // Quitamos "COP" para un texto más natural
  return `${fmt.replace("COP", "").trim()} pesos`;
}

// Función para convertir números a letras en español
function numeroAPalabras(num) {
  const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const decenas = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  
  // Redondear a dos decimales
  const entero = Math.floor(num);
  const decimal = Math.round((num - entero) * 100);
  
  if (num === 0) return 'cero pesos';
  if (num > 999999999) return 'Número demasiado grande';
  
  let palabras = '';
  
  // Convertir parte entera
  if (entero > 0) {
    // Millones
    if (entero >= 1000000) {
      const millones = Math.floor(entero / 1000000);
      palabras += convertirGrupo(millones, unidades, decenas, especiales, centenas) + (millones === 1 ? ' millón ' : ' millones ');
      num = entero % 1000000;
    }
    
    // Miles
    if (entero >= 1000) {
      const miles = Math.floor(entero % 1000000 / 1000);
      if (miles > 0) {
        palabras += convertirGrupo(miles, unidades, decenas, especiales, centenas) + ' mil ';
      }
      num = entero % 1000;
    }
    
    // Centenas, decenas y unidades
    if (entero % 1000 > 0) {
      palabras += convertirGrupo(entero % 1000, unidades, decenas, especiales, centenas) + ' ';
    }
    
    palabras += entero === 1 ? 'peso' : 'pesos';
  }
  
  // Convertir parte decimal
  if (decimal > 0) {
    palabras += ' con ' + convertirGrupo(decimal, unidades, decenas, especiales, centenas) + ' centavos';
  }
  
  return palabras.trim();
}

function convertirGrupo(num, unidades, decenas, especiales, centenas) {
  let resultado = '';
  
  // Centenas
  if (num >= 100) {
    const centena = Math.floor(num / 100);
    if (centena === 1 && num % 100 === 0) {
      resultado = 'cien';
    } else {
      resultado = centenas[centena];
    }
    num = num % 100;
    
    if (num > 0) resultado += ' ';
  }
  
  // Decenas y unidades
  if (num >= 10 && num <= 19) {
    resultado += especiales[num - 10];
  } else {
    const decena = Math.floor(num / 10);
    const unidad = num % 10;
    
    if (decena > 0) {
      resultado += decenas[decena];
      if (unidad > 0) resultado += ' y ';
    }
    
    if (unidad > 0) {
      resultado += unidades[unidad];
    }
  }
  
  return resultado;
}

// Hacer accesible globalmente
window.numeroALetras = numeroALetras;
window.numeroAPalabras = numeroAPalabras;
