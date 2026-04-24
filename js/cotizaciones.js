// js/cotizaciones.js
const form = document.getElementById("form-cotizacion");
const tablaItems = document.querySelector("#tabla-items tbody");
const tablaCotizaciones = document.querySelector("#tabla-cotizaciones tbody");
const clienteSelect = document.getElementById("cliente");
const formaPagoSelect = document.getElementById("forma-pago");
const pagosPersonalizadosDiv = document.getElementById("pagos-personalizados");
const campoValorTotal = document.getElementById("campo-valor-total");
const inputValorTotal = document.getElementById("valor-total");

// ============================
// 🔹 Variables para anexos
// ============================
const toggleBtn = document.getElementById("toggle-anexos");
const seccionAnexos = document.getElementById("seccion-anexos");
const iconAnexos = document.getElementById("icon-anexos");
const anexosInput = document.getElementById("anexos-input");
const listaAnexos = document.getElementById("lista-anexos");

let items = [];
let tipoCalculo = "por-items";
let anexosSeleccionados = [];

// ============================
// 🔹 Inicialización de anexos
// ============================
if (toggleBtn && seccionAnexos) {
  toggleBtn.onclick = () => {
    seccionAnexos.classList.toggle("hidden");
    if (iconAnexos) {
      iconAnexos.textContent = seccionAnexos.classList.contains("hidden") ? "+" : "−";
    }
  };
}

if (anexosInput) {
  anexosInput.onchange = () => {
    anexosSeleccionados = Array.from(anexosInput.files);
    if (listaAnexos) {
      listaAnexos.innerHTML = anexosSeleccionados
        .map(f => `<li>📄 ${f.name} (${Math.round(f.size / 1024)} KB)</li>`)
        .join("");
    }
  };
}

// ============================
// 🔹 Convertir archivo a Base64
// ============================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================
// 🔹 Procesar anexos antes de guardar
// ============================
async function procesarAnexos() {
  const anexos = [];

  for (const file of anexosSeleccionados) {
    if (file.size > 500 * 1024) {
      alert(`❌ ${file.name} supera 500 KB`);
      continue;
    }

    const base64 = await fileToBase64(file);

    anexos.push({
      nombre: file.name,
      tipo: file.type,
      base64,
      fecha: new Date()
    });
  }

  return anexos;
}

// ============================
// 🔹 Toggle columnas de items
// ============================
function toggleColumnasItems() {
  const headers = document.querySelectorAll("#tabla-items th");
  const cells = document.querySelectorAll("#tabla-items td");
  
  if (tipoCalculo === "valor-total") {
    headers[1].classList.add("hidden");
    headers[2].classList.add("hidden");
    headers[3].classList.add("hidden");
    
    for (let i = 0; i < cells.length; i++) {
      const position = i % 5;
      if (position === 1 || position === 2 || position === 3) {
        cells[i].classList.add("hidden");
      }
    }
    
    document.getElementById("agregar-item").textContent = "+ Agregar Descripción";
  } else {
    headers[1].classList.remove("hidden");
    headers[2].classList.remove("hidden");
    headers[3].classList.remove("hidden");
    
    for (let i = 0; i < cells.length; i++) {
      cells[i].classList.remove("hidden");
    }
    
    document.getElementById("agregar-item").textContent = "+ Agregar Ítem";
  }
}

// ============================
// 🔹 Cargar clientes en select
// ============================
async function cargarClientes() {
  clienteSelect.innerHTML = '<option value="">-- Selecciona un cliente --</option>';
  const snap = await db.collection("clientes").get();
  snap.forEach(doc => {
    const c = doc.data();
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = c.nombre || c.nombreEmpresa || "Sin nombre";
    // 🔹 Guardamos datos extra en dataset para usarlos al guardar
    opt.dataset.tipoIdentificacion = c.tipoIdentificacion || (c.nit ? "NIT" : "CC");
    opt.dataset.identificacion     = c.identificacion || c.nit || c.numeroDocumento || "";
    // legacy
    opt.dataset.nit = c.nit || "";
    opt.dataset.numeroDocumento = c.numeroDocumento || "";
    opt.dataset.telefono = c.telefono || "";
    clienteSelect.appendChild(opt);
  });
}

// ============================
// 🔹 Manejar forma de pago
// ============================
formaPagoSelect.addEventListener("change", function() {
  if (this.value === "personalizado") {
    pagosPersonalizadosDiv.classList.remove("hidden");
  } else {
    pagosPersonalizadosDiv.classList.add("hidden");
  }
});

document.getElementById("pago1").addEventListener("input", validarPagos);
document.getElementById("pago2").addEventListener("input", validarPagos);
document.getElementById("pago3").addEventListener("input", validarPagos);

function validarPagos() {
  const pago1 = Number(document.getElementById("pago1").value) || 0;
  const pago2 = Number(document.getElementById("pago2").value) || 0;
  const pago3 = Number(document.getElementById("pago3").value) || 0;
  const total = pago1 + pago2 + pago3;

  if (total !== 100) {
    pagosPersonalizadosDiv.style.border = "2px solid red";
    pagosPersonalizadosDiv.style.padding = "5px";
    return false;
  } else {
    pagosPersonalizadosDiv.style.border = "";
    pagosPersonalizadosDiv.style.padding = "";
    return true;
  }
}

// ============================
// 🔹 Manejar tipo de cálculo
// ============================
document.querySelectorAll('input[name="tipo-calculo"]').forEach(radio => {
  radio.addEventListener("change", function() {
    tipoCalculo = this.value;
    
    if (tipoCalculo === "valor-total") {
      campoValorTotal.classList.remove("hidden");
    } else {
      campoValorTotal.classList.add("hidden");
    }
    
    toggleColumnasItems();
    recalcular();
  });
});

inputValorTotal.addEventListener("input", recalcular);

// ============================
// 🔹 Ítems dinámicos
// ============================
document.getElementById("agregar-item").addEventListener("click", () => {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td><input type="text" class="desc border p-1 w-full" placeholder="Descripción" spellcheck="true" lang="es"></td>
    <td><input type="number" class="cant border p-1 w-full" value="1" min="1"></td>
    <td><input type="number" class="precio border p-1 w-full" value="0" min="0" placeholder="Precio"></td>
    <td class="subtotal text-right p-2">0</td>
    <td><button type="button" class="text-red-600">Eliminar</button></td>
  `;

  row.querySelector(".cant").addEventListener("input", recalcular);
  row.querySelector(".precio").addEventListener("input", recalcular);
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
    recalcular();
  });

  tablaItems.appendChild(row);
  toggleColumnasItems();
  recalcular();
});

function recalcular() {
  let subtotal = 0;
  let total = 0;
  
  items = [];
  
  if (tipoCalculo === "por-items") {
    tablaItems.querySelectorAll("tr").forEach(tr => {
      const desc = tr.querySelector(".desc").value;
      const cant = Number(tr.querySelector(".cant").value) || 0;
      const precio = Number(tr.querySelector(".precio").value) || 0;
      const sub = cant * precio;
      tr.querySelector(".subtotal").textContent = sub.toLocaleString("es-CO");
      subtotal += sub;
      items.push({ descripcion: desc, cantidad: cant, precio, subtotal: sub });
    });
    
    total = subtotal;
  } else {
    total = Number(inputValorTotal.value) || 0;
    
    tablaItems.querySelectorAll("tr").forEach(tr => {
      const desc = tr.querySelector(".desc").value;
      const cant = Number(tr.querySelector(".cant").value) || 0;
      const precio = Number(tr.querySelector(".precio").value) || 0;
      const sub = cant * precio;
      
      tr.querySelector(".subtotal").textContent = sub.toLocaleString("es-CO");
      items.push({ descripcion: desc, cantidad: cant, precio, subtotal: sub });
    });
    
    subtotal = total;
  }
  
  document.getElementById("subtotal").textContent = `Subtotal: $${subtotal.toLocaleString("es-CO")}`;
  document.getElementById("total").textContent = `Total: $${total.toLocaleString("es-CO")}`;
  
  const mostrarValorLetras = document.getElementById("mostrar-valor-letras").checked;
  if (mostrarValorLetras) {
    document.getElementById("valor-letras").textContent = numeroAPalabras(total);
  } else {
    document.getElementById("valor-letras").textContent = "";
  }
  
  return { subtotal, total };
}

// ============================
// 🔹 Notas por viñetas
// ============================
function leerNotasComoArray() {
  // Lee el modo activo: "libre" o "vinetas"
  const modoLibre = document.getElementById("notas-modo-libre");
  if (modoLibre && !modoLibre.classList.contains("hidden")) {
    // Modo texto libre: cada línea es una viñeta al guardar
    const texto = document.getElementById("notas").value.trim();
    return texto ? texto.split("\n").filter(l => l.trim() !== "") : [];
  } else {
    // Modo viñetas individuales
    const inputs = document.querySelectorAll(".nota-vineta-input");
    const arr = [];
    inputs.forEach(inp => {
      if (inp.value.trim()) arr.push(inp.value.trim());
    });
    return arr;
  }
}

function agregarViñeta(texto = "") {
  const container = document.getElementById("notas-vinetas-container");
  if (!container) return;
  const div = document.createElement("div");
  div.className = "flex items-center gap-2 mb-2";
  div.innerHTML = `
    <span class="text-gray-400">•</span>
    <input type="text" class="nota-vineta-input border rounded px-3 py-1.5 flex-grow text-sm"
      placeholder="Escribe una nota..." value="${texto.replace(/"/g, '&quot;')}"
      spellcheck="true" lang="es">
    <button type="button" class="text-red-500 hover:text-red-700 text-lg leading-none">✕</button>
  `;
  div.querySelector("button").addEventListener("click", () => div.remove());
  container.appendChild(div);
}

// ============================
// 🔹 Guardar cotización
// ============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const clienteId = clienteSelect.value;

  // 🔹 Leer notas (soporte viñetas)
  const notasArray = leerNotasComoArray();
  const notas = notasArray.join("\n"); // guardamos como texto separado por saltos

  const ubicacion = document.getElementById("ubicacion").value || "";
  const tipoCotizacion = document.querySelector('input[name="tipo"]:checked').value;
  const formaPago = formaPagoSelect.value;
  const mostrarValorLetras = document.getElementById("mostrar-valor-letras").checked;
  const { subtotal, total } = recalcular();

  // 🔹 Leer checkbox de mostrar documento
  const mostrarDocumento = document.getElementById("mostrar-documento")
    ? document.getElementById("mostrar-documento").checked
    : true;
  
  if (formaPago === "personalizado" && !validarPagos()) {
    alert("Los pagos personalizados deben sumar 100%");
    return;
  }

  if (!clienteId) {
    alert("Selecciona un cliente");
    return;
  }

  if (tipoCalculo === "por-items" && items.length === 0) {
    alert("Agrega al menos un ítem a la cotización");
    return;
  }

  if (tipoCalculo === "valor-total" && total <= 0) {
    alert("Ingresa un valor total válido");
    return;
  }

  const clienteDoc = await db.collection("clientes").doc(clienteId).get();
  const clienteData = clienteDoc.data() || {};

  // Tomar identificación del cliente (campo unificado + compatibilidad legacy)
  const selectedOpt = clienteSelect.options[clienteSelect.selectedIndex];
  const clienteTipoIdentificacion = selectedOpt?.dataset.tipoIdentificacion
    || clienteData.tipoIdentificacion
    || (clienteData.nit ? "NIT" : "CC");
  const clienteIdentificacion = selectedOpt?.dataset.identificacion
    || clienteData.identificacion
    || clienteData.nit
    || clienteData.numeroDocumento
    || "";
  // Legacy — mantener compatibilidad con documentos ya guardados
  const clienteNit = clienteTipoIdentificacion === "NIT" ? clienteIdentificacion : (clienteData.nit || "");
  const clienteNumeroDocumento = clienteTipoIdentificacion !== "NIT" ? clienteIdentificacion : (clienteData.numeroDocumento || "");

  let planPagos = [];
  if (formaPago === "contado") {
    planPagos = [{ porcentaje: 100, monto: total, descripcion: "Pago completo al contado" }];
  } else if (formaPago === "60-40") {
    planPagos = [
      { porcentaje: 60, monto: total * 0.6, descripcion: "60% al inicio" },
      { porcentaje: 40, monto: total * 0.4, descripcion: "40% al finalizar" }
    ];
  } else if (formaPago === "50-50") {
    planPagos = [
      { porcentaje: 50, monto: total * 0.5, descripcion: "50% al inicio" },
      { porcentaje: 50, monto: total * 0.5, descripcion: "50% al finalizar" }
    ];
  } else if (formaPago === "tres-pagos") {
    planPagos = [
      { porcentaje: 40, monto: total * 0.4, descripcion: "40% al inicio" },
      { porcentaje: 30, monto: total * 0.3, descripcion: "30% al avance 50%" },
      { porcentaje: 30, monto: total * 0.3, descripcion: "30% al finalizar" }
    ];
  } else if (formaPago === "personalizado") {
    const pago1 = Number(document.getElementById("pago1").value) || 0;
    const pago2 = Number(document.getElementById("pago2").value) || 0;
    const pago3 = Number(document.getElementById("pago3").value) || 0;
    
    planPagos = [
      { porcentaje: pago1, monto: total * (pago1/100), descripcion: `Pago 1 (${pago1}%)` }
    ];
    
    if (pago2 > 0) {
      planPagos.push({ porcentaje: pago2, monto: total * (pago2/100), descripcion: `Pago 2 (${pago2}%)` });
    }
    
    if (pago3 > 0) {
      planPagos.push({ porcentaje: pago3, monto: total * (pago3/100), descripcion: `Pago 3 (${pago3}%)` });
    }
  }

  const anexos = await procesarAnexos();

  const cotizacion = {
    clienteId,
    nombreCliente: clienteData.nombre || clienteData.nombreEmpresa || "Sin nombre",
    telefono: clienteData.telefono || "",
    clienteTipoIdentificacion,
    clienteIdentificacion,
    clienteNit,
    clienteNumeroDocumento,
    mostrarDocumento,
    notas,
    notasArray,                 // 🔹 NUEVO: guardamos también el array
    ubicacion,
    tipo: tipoCotizacion,
    formaPago,
    planPagos,
    items,
    subtotal,
    total,
    fecha: new Date(),
    estado: "pendiente",
    mostrarValorLetras,
    tipoCalculo,
    anexos
  };

  const docRef = await db.collection("cotizaciones").add(cotizacion);

  await db.collection("cotizaciones").doc(docRef.id).update({
    linkPublico: `https://domka-sw.github.io/domka-cotizador/public/cotizacion.html?id=${docRef.id}`
  });

  alert("✅ Cotización guardada");
  form.reset();
  tablaItems.innerHTML = "";
  pagosPersonalizadosDiv.classList.add("hidden");
  document.getElementById("valor-letras").textContent = "Cero pesos";
  
  if (anexosInput) anexosInput.value = "";
  if (listaAnexos) listaAnexos.innerHTML = "";
  anexosSeleccionados = [];

  // Limpiar viñetas
  const vContainer = document.getElementById("notas-vinetas-container");
  if (vContainer) vContainer.innerHTML = "";
  
  document.querySelector('input[name="tipo-calculo"][value="por-items"]').checked = true;
  tipoCalculo = "por-items";
  campoValorTotal.classList.add("hidden");
  toggleColumnasItems();
  
  cargarCotizaciones();
});

// ============================
// 🔹 Listar cotizaciones
// ============================
async function cargarCotizaciones() {
  tablaCotizaciones.innerHTML = "";
  const snap = await db.collection("cotizaciones").orderBy("fecha", "desc").get();
  snap.forEach(doc => {
    const c = doc.data();
    const nombreCliente = c.nombreCliente || c.clienteId;
    
    let tipoTexto = "";
    switch(c.tipo) {
      case "mano-obra": tipoTexto = "Mano de obra"; break;
      case "materiales": tipoTexto = "Materiales"; break;
      case "ambos": tipoTexto = "Mano de obra y materiales"; break;
      default: tipoTexto = c.tipo || "No especificado";
    }

    const tieneAnexos = c.anexos && c.anexos.length > 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-2">
        ${nombreCliente}
        ${tieneAnexos ? '<span class="bg-blue-500 text-white text-xs px-2 py-1 rounded ml-2">📎</span>' : ''}
      </td>
      <td class="p-2">$${Number(c.total || 0).toLocaleString("es-CO")}</td>
      <td class="p-2">${tipoTexto}</td>
      <td class="p-2 flex gap-2">
        <button class="bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700 btn-pdf">PDF</button>
        <a class="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700" target="_blank"
          href="https://wa.me/${c.telefono}?text=${encodeURIComponent(`Hola ${nombreCliente} , aquí tienes tu cotización: ${c.linkPublico || ''}`)}">WhatsApp</a>
      </td>
    `;

    tr.querySelector(".btn-pdf").addEventListener("click", () => {
      generarPDFCotizacion({...c, id: doc.id}, nombreCliente);
    });

    tablaCotizaciones.appendChild(tr);
  });
}

document.addEventListener("DOMContentLoaded", function() {
  cargarClientes();
  cargarCotizaciones();
  toggleColumnasItems();

  // ── Corrector ortografía en tiempo real ──
  if (typeof ltActivar === "function") ltActivar();
  if (typeof ltObservar === "function") {
    ltObservar(document.querySelector("#tabla-items tbody"));
    ltObservar(document.getElementById("notas-vinetas-container"));
  }

  // ============================
  // 🔹 Inicializar sistema de viñetas en notas
  // ============================
  const btnModoLibre = document.getElementById("btn-notas-libre");
  const btnModoVinetas = document.getElementById("btn-notas-vinetas");
  const modoLibreDiv = document.getElementById("notas-modo-libre");
  const modoVinetasDiv = document.getElementById("notas-modo-vinetas");
  const btnAgregarVineta = document.getElementById("agregar-vineta");

  if (btnModoLibre && btnModoVinetas) {
    btnModoLibre.addEventListener("click", () => {
      modoLibreDiv.classList.remove("hidden");
      modoVinetasDiv.classList.add("hidden");
      btnModoLibre.classList.add("bg-orange-600", "text-white");
      btnModoLibre.classList.remove("bg-gray-100", "text-gray-700");
      btnModoVinetas.classList.remove("bg-orange-600", "text-white");
      btnModoVinetas.classList.add("bg-gray-100", "text-gray-700");
    });

    btnModoVinetas.addEventListener("click", () => {
      modoVinetasDiv.classList.remove("hidden");
      modoLibreDiv.classList.add("hidden");
      btnModoVinetas.classList.add("bg-orange-600", "text-white");
      btnModoVinetas.classList.remove("bg-gray-100", "text-gray-700");
      btnModoLibre.classList.remove("bg-orange-600", "text-white");
      btnModoLibre.classList.add("bg-gray-100", "text-gray-700");
    });
  }

  if (btnAgregarVineta) {
    btnAgregarVineta.addEventListener("click", () => agregarViñeta());
  }
});
