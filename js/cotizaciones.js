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
    empresaId: clienteData.empresaId || clienteData.empresa || null,
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
    creadoPor: window.auth?.currentUser?.uid || null,
    mostrarValorLetras,
    tipoCalculo,
    anexos
  };

  const docRef = await db.collection("cotizaciones").add(cotizacion);

  // Link público en Vercel (mismo dominio)
  const base = window.DOMKA_CONFIG?.PUBLIC_BASE_URL || window.location.origin;
  const publicPath = window.DOMKA_CONFIG?.ROUTES?.publicQuote || "/public/cotizacion.html";
  const linkPublico = `${base}${publicPath}?id=${docRef.id}`;

  await db.collection("cotizaciones").doc(docRef.id).update({ linkPublico });

  // Documento sanitizado para lectura pública (reglas: publicQuotes)
  await db.collection("publicQuotes").doc(docRef.id).set({
    enabled: true,
    cotizacionId: docRef.id,
    clienteId,
    empresaId: clienteData.empresaId || clienteData.empresa || null,
    nombreCliente: clienteData.nombre || clienteData.nombreEmpresa || "Sin nombre",
    telefono: clienteData.telefono || "",
    clienteTipoIdentificacion,
    clienteIdentificacion,
    clienteNit,
    clienteNumeroDocumento,
    mostrarDocumento,
    notas,
    notasArray,
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
  }, { merge: true });

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
// 🔹 Listar cotizaciones — v2
// Cambios: .limit(100), búsqueda en memoria, columnas estado/fecha/número,
//          botones Aprobar / Rechazar, badge de estado visual.
// ============================
let _todasCotizaciones = [];   // caché en memoria para búsqueda sin queries extra

const ESTADO_BADGE = {
  pendiente:    "bg-yellow-100 text-yellow-800",
  borrador:     "bg-gray-100 text-gray-600",
  enviada:      "bg-blue-100 text-blue-800",
  en_revision:  "bg-purple-100 text-purple-800",
  aceptada:     "bg-green-100 text-green-800",
  aprobada:     "bg-green-100 text-green-800",
  rechazada:    "bg-red-100 text-red-800",
  vencida:      "bg-orange-100 text-orange-800"
};

function estadoBadge(estado) {
  const cls = ESTADO_BADGE[estado] || "bg-gray-100 text-gray-600";
  const label = {
    pendiente:"Pendiente", borrador:"Borrador", enviada:"Enviada",
    en_revision:"En revisión", aceptada:"Aceptada", aprobada:"Aprobada",
    rechazada:"Rechazada", vencida:"Vencida"
  }[estado] || estado || "—";
  return `<span class="text-xs font-semibold px-2 py-1 rounded-full ${cls}">${label}</span>`;
}

function renderCotizaciones(lista) {
  if (!tablaCotizaciones) return;
  if (!lista.length) {
    tablaCotizaciones.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400">Sin cotizaciones.</td></tr>`;
    return;
  }

  tablaCotizaciones.innerHTML = "";
  lista.forEach(({ id, c }) => {
    const nombreCliente = c.nombreCliente || c.clienteId || "—";
    const tieneAnexos   = c.anexos?.length > 0;
    const numero        = c.numero || id.slice(0, 6).toUpperCase();
    const fechaStr      = c.fecha?.toDate
      ? c.fecha.toDate().toLocaleDateString("es-CO")
      : c.fecha ? new Date(c.fecha).toLocaleDateString("es-CO") : "—";

    let tipoTexto = { "mano-obra":"Mano de obra", "materiales":"Materiales", "ambos":"MO + Mat." }[c.tipo] || c.tipo || "—";

    const estado = c.estado || "pendiente";
    const puedeAprobar = estado !== "aceptada" && estado !== "aprobada";
    const puedeRechazar = estado !== "rechazada";

    const tr = document.createElement("tr");
    tr.className = "border-b hover:bg-gray-50";
    tr.innerHTML = `
      <td class="p-2 text-xs text-gray-500 font-mono">${numero}</td>
      <td class="p-2">
        <div class="font-medium text-sm">${nombreCliente}</div>
        <div class="text-xs text-gray-400">${tipoTexto}</div>
        ${tieneAnexos ? '<span class="text-xs text-blue-500">📎 anexos</span>' : ''}
      </td>
      <td class="p-2 font-medium">$${Number(c.total || 0).toLocaleString("es-CO")}</td>
      <td class="p-2">${estadoBadge(estado)}</td>
      <td class="p-2 text-xs text-gray-500">${fechaStr}</td>
      <td class="p-2">
        <div class="flex flex-wrap gap-1">
          <button class="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700 btn-pdf">PDF</button>
          <a class="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 no-underline" target="_blank"
            href="https://wa.me/${c.telefono || ''}?text=${encodeURIComponent(`Hola ${nombreCliente}, aquí tienes tu cotización: ${c.linkPublico || ''}`)}">WA</a>
          ${puedeAprobar ? `<button class="text-xs bg-green-100 text-green-700 border border-green-300 px-2 py-1 rounded hover:bg-green-200 btn-aprobar">✔ Aprobar</button>` : ""}
          ${puedeRechazar ? `<button class="text-xs bg-red-100 text-red-700 border border-red-300 px-2 py-1 rounded hover:bg-red-200 btn-rechazar">✘ Rechazar</button>` : ""}
        </div>
      </td>
    `;

    tr.querySelector(".btn-pdf").addEventListener("click", () => {
      generarPDFCotizacion({ ...c, id }, nombreCliente);
    });

    if (puedeAprobar) {
      tr.querySelector(".btn-aprobar").addEventListener("click", async () => {
        if (!confirm(`¿Aprobar la cotización de ${nombreCliente}?`)) return;
        try {
          await db.collection("cotizaciones").doc(id).update({
            estado: "aceptada",
            aprobadoPor: window.auth?.currentUser?.uid || null,
            aprobadoEn: new Date().toISOString()
          });
          await db.collection("publicQuotes").doc(id).update({ estado: "aceptada" }).catch(() => {});
          await cargarCotizaciones();
        } catch (err) {
          alert("Error al aprobar: " + (err?.message || err));
        }
      });
    }

    if (puedeRechazar) {
      tr.querySelector(".btn-rechazar").addEventListener("click", async () => {
        const motivo = prompt("Motivo del rechazo (opcional):");
        if (motivo === null) return; // cancelado
        try {
          await db.collection("cotizaciones").doc(id).update({
            estado: "rechazada",
            rechazadoPor: window.auth?.currentUser?.uid || null,
            rechazadoEn: new Date().toISOString(),
            comentarioAprobacion: motivo || ""
          });
          await db.collection("publicQuotes").doc(id).update({ estado: "rechazada" }).catch(() => {});
          await cargarCotizaciones();
        } catch (err) {
          alert("Error al rechazar: " + (err?.message || err));
        }
      });
    }

    tablaCotizaciones.appendChild(tr);
  });
}

async function cargarCotizaciones() {
  if (tablaCotizaciones) tablaCotizaciones.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400">Cargando…</td></tr>`;
  try {
    // Esperar auth state resuelto — currentUser es null en DOMContentLoaded
    const user = window.auth?.currentUser || await new Promise(resolve => {
      const unsub = window.auth.onAuthStateChanged(u => { unsub(); resolve(u || null); });
    });
    if (!user) return;

    let perfil = null;
    if (typeof window.cargarPerfil === "function") {
      perfil = await window.cargarPerfil(user).catch(() => null);
    }

    let snap;
    if (perfil?.role === "comercial") {
      // Comercial solo ve sus propias cotizaciones.
      // SIN orderBy porque array-contains/equality + orderBy requiere índice compuesto.
      // Ordenamos client-side.
      snap = await db.collection("cotizaciones")
        .where("creadoPor", "==", user.uid)
        .limit(200)
        .get();
    } else {
      snap = await db.collection("cotizaciones")
        .orderBy("fecha", "desc")
        .limit(100)
        .get();
    }

    _todasCotizaciones = snap.docs
      .map(doc => ({ id: doc.id, c: doc.data() }))
      .sort((a, b) => {
        // Ordenar client-side para que comercial también vea orden correcto
        const fa = a.c.fecha?.toDate ? a.c.fecha.toDate().getTime() : new Date(a.c.fecha || 0).getTime();
        const fb = b.c.fecha?.toDate ? b.c.fecha.toDate().getTime() : new Date(b.c.fecha || 0).getTime();
        return fb - fa;
      });
    aplicarBusquedaCotizaciones();
  } catch(e) {
    console.error("[cotizaciones]", e);
    if (tablaCotizaciones) tablaCotizaciones.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">Error cargando cotizaciones.</td></tr>`;
  }
}

function aplicarBusquedaCotizaciones() {
  const searchEl = document.getElementById("cot-search");
  const q = (searchEl?.value || "").toLowerCase().trim();
  const lista = q
    ? _todasCotizaciones.filter(({ c }) =>
        (c.nombreCliente || "").toLowerCase().includes(q) ||
        (c.numero || "").toLowerCase().includes(q) ||
        (c.estado || "").toLowerCase().includes(q)
      )
    : _todasCotizaciones;
  renderCotizaciones(lista);
}

// Buscar al escribir
document.addEventListener("DOMContentLoaded", () => {
  const searchEl = document.getElementById("cot-search");
  if (searchEl) searchEl.addEventListener("input", aplicarBusquedaCotizaciones);
});

document.addEventListener("DOMContentLoaded", async function() {
  try {
    await Promise.resolve(window.__domkaFirebaseReady);
    if (!window.db) throw new Error("Firestore no inicializado.");
    await cargarClientes();
    await cargarCotizaciones();
    toggleColumnasItems();
  } catch (e) {
    console.error(e);
  }

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
