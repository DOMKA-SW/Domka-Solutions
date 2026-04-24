// js/cuentas.js
const formCuenta = document.getElementById("form-cuenta");
const selectCliente = document.getElementById("cliente");
const itemsContainer = document.getElementById("items-container");
const tablaCuentas = document.querySelector("#tabla-cuentas tbody");
const agregarItemBtn = document.getElementById("agregar-item");
const valorTotalInput = document.getElementById("valor-total");
let items = [];
const BASE_PUBLICA = "https://domka-sw.github.io/domka-cotizador";

// ============================
// 🔹 Variables para anexos
// ============================
const toggleBtn = document.getElementById("toggle-anexos");
const seccionAnexos = document.getElementById("seccion-anexos");
const iconAnexos = document.getElementById("icon-anexos");
const anexosInput = document.getElementById("anexos-input");
const listaAnexos = document.getElementById("lista-anexos");
let anexosSeleccionados = [];

// Cargar clientes
async function cargarClientes() {
  try {
    const snap = await db.collection("clientes").get();
    selectCliente.innerHTML = '<option value="">-- Selecciona un cliente --</option>';
    
    snap.forEach(docu => {
      const c = docu.data();
      const opt = document.createElement("option");
      opt.value = docu.id;
      opt.textContent = c.nombreEmpresa || c.nombre || `(sin nombre)`;
      opt.dataset.telefono = c.telefono || "";
      opt.dataset.tipoIdentificacion = c.tipoIdentificacion || (c.nit ? "NIT" : "CC");
      opt.dataset.identificacion     = c.identificacion || c.nit || c.numeroDocumento || "";
      // legacy
      opt.dataset.nit = c.nit || "";
      opt.dataset.numeroDocumento = c.numeroDocumento || "";
      selectCliente.appendChild(opt);
    });
  } catch (e) {
    console.error("Error cargando clientes:", e);
    alert("No se pudieron cargar los clientes.");
  }
}

// Agregar ítem
function agregarItem(descripcion = "") {
  const itemDiv = document.createElement("div");
  itemDiv.className = "flex items-center mb-2";
  itemDiv.innerHTML = `
    <input type="text" class="item-desc border rounded px-3 py-2 flex-grow mr-2" 
           placeholder="Descripción del servicio" value="${descripcion.replace(/"/g, '&quot;')}"
           spellcheck="true" lang="es">
    <button type="button" class="eliminar-item text-red-600 hover:text-red-800 px-2 py-1">
      ✕
    </button>
  `;
  
  itemDiv.querySelector(".eliminar-item").addEventListener("click", () => {
    itemDiv.remove();
  });
  
  itemsContainer.appendChild(itemDiv);
}

// Actualizar array de items
function actualizarItems() {
  items = [];
  document.querySelectorAll(".item-desc").forEach(input => {
    if (input.value.trim() !== "") {
      items.push({ descripcion: input.value.trim() });
    }
  });
}

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
// 🔹 Notas por viñetas
// ============================
function leerNotasComoArray() {
  const modoLibre = document.getElementById("notas-modo-libre");
  if (modoLibre && !modoLibre.classList.contains("hidden")) {
    const texto = document.getElementById("notas").value.trim();
    return texto ? texto.split("\n").filter(l => l.trim() !== "") : [];
  } else {
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

// Guardar cuenta de cobro
formCuenta.addEventListener("submit", async (e) => {
  e.preventDefault();

  const clienteId = selectCliente.value;

  // 🔹 Leer notas (soporte viñetas)
  const notasArray = leerNotasComoArray();
  const notas = notasArray.join("\n");

  const valorTotal = Number(valorTotalInput.value) || 0;
  const mostrarValorLetras = document.getElementById("mostrar-valor-letras").checked;

  const concepto = document.getElementById("concepto").value.trim();
  const fechaEmision = document.getElementById("fecha-emision").value 
    ? new Date(document.getElementById("fecha-emision").value)
    : new Date();

  // 🔹 Checkbox mostrar documento
  const mostrarDocumento = document.getElementById("mostrar-documento")
    ? document.getElementById("mostrar-documento").checked
    : true;
  
  actualizarItems();
  
  if (!clienteId) {
    alert("Selecciona un cliente.");
    return;
  }
  
  if (items.length === 0) {
    alert("Agrega al menos un ítem/descripción.");
    return;
  }
  
  if (valorTotal <= 0) {
    alert("Ingresa un valor total válido.");
    return;
  }
  
  try {
    const anexos = await procesarAnexos();
    
    const clienteDoc = await db.collection("clientes").doc(clienteId).get();
    const clienteData = clienteDoc.data() || {};
    const nombreCliente = clienteData.nombreEmpresa || clienteData.nombre || "(sin nombre)";
    const telefonoCliente = clienteData.telefono || "";

    // Tomar identificación del cliente (campo unificado + compatibilidad legacy)
    const selectedOpt = selectCliente.options[selectCliente.selectedIndex];
    const clienteTipoIdentificacion = selectedOpt?.dataset.tipoIdentificacion
      || clienteData.tipoIdentificacion
      || (clienteData.nit ? "NIT" : "CC");
    const clienteIdentificacion = selectedOpt?.dataset.identificacion
      || clienteData.identificacion
      || clienteData.nit
      || clienteData.numeroDocumento
      || "";
    // Legacy
    const clienteNit = clienteTipoIdentificacion === "NIT" ? clienteIdentificacion : (clienteData.nit || "");
    const clienteNumeroDocumento = clienteTipoIdentificacion !== "NIT" ? clienteIdentificacion : (clienteData.numeroDocumento || "");
    
    const docRef = await db.collection("cuentas").add({
      clienteId,
      nombreCliente,
      telefonoCliente,
      clienteTipoIdentificacion,
      clienteIdentificacion,
      clienteNit,
      clienteNumeroDocumento,
      mostrarDocumento,
      concepto,
      notas,
      notasArray,              // 🔹 NUEVO: guardamos array
      items,
      total: valorTotal,
      subtotal: valorTotal,
      fecha: fechaEmision,
      estado: "pendiente",
      mostrarValorLetras,
      firmaNombre: "DOMKA",
      firmaTelefono: "+57 321 456 7890",
      firmaEmail: "contacto@domka.com",
      firmaRut: "123456789-0",
      anexos
    });
    
    const linkPublico = `${BASE_PUBLICA}/public/cuenta.html?id=${docRef.id}`;
    await db.collection("cuentas").doc(docRef.id).update({ linkPublico });
    
    alert("✅ Cuenta de cobro guardada correctamente");
    
    formCuenta.reset();
    itemsContainer.innerHTML = "";
    items = [];
    valorTotalInput.value = "0";
    
    if (anexosInput) anexosInput.value = "";
    if (listaAnexos) listaAnexos.innerHTML = "";
    anexosSeleccionados = [];

    // Limpiar viñetas
    const vContainer = document.getElementById("notas-vinetas-container");
    if (vContainer) vContainer.innerHTML = "";
    
    cargarCuentas();
  } catch (e) {
    console.error("Error guardando cuenta:", e);
    alert("Error guardando la cuenta de cobro.");
  }
});

// ============================
// 🔹 Listar cuentas de cobro
// ============================
async function cargarCuentas() {
  tablaCuentas.innerHTML = "";

  try {
    const snap = await db.collection("cuentas").orderBy("fecha", "desc").get();

    snap.forEach(docu => {
      const c = docu.data();
      const id = docu.id;
      const tieneAnexos = c.anexos && c.anexos.length > 0;

      const tr = document.createElement("tr");
      tr.className = "border-t hover:bg-gray-50";
      tr.innerHTML = `
        <td class="p-2">
          ${c.nombreCliente || "Sin nombre"}
          ${tieneAnexos ? '<span class="ml-2 text-blue-600">📎</span>' : ''}
        </td>
        <td class="p-2 text-right">$${Number(c.total || 0).toLocaleString("es-CO")}</td>
        <td class="p-2 text-center">
          <span class="px-2 py-1 rounded text-xs ${c.estado === "pagada" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}">
            ${c.estado || "pendiente"}
          </span>
        </td>
        <td class="p-2">${c.fecha?.toDate ? c.fecha.toDate().toLocaleDateString() : new Date(c.fecha).toLocaleDateString()}</td>
        <td class="p-2 flex flex-wrap gap-2">
          <button data-id="${id}" class="btn-pdf bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700">PDF</button>
          <a class="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
             target="_blank"
             href="https://wa.me/${c.telefonoCliente}?text=${encodeURIComponent(`Hola, aquí tienes tu cuenta de cobro DOMKA: ${c.linkPublico || ''}`)}">
            WhatsApp
          </a>
          <button data-id="${id}" class="btn-pagada bg-gray-800 text-white px-2 py-1 rounded hover:bg-gray-700">Marcar pagada</button>
        </td>
      `;
      tablaCuentas.appendChild(tr);
    });

    // PDF handlers
    tablaCuentas.querySelectorAll(".btn-pdf").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        try {
          const docu = await db.collection("cuentas").doc(id).get();
          if (docu.exists) {
            const cuenta = docu.data();
            cuenta.id = id;
            generarPDFCuenta(cuenta, cuenta.nombreCliente);
          } else {
            alert("Cuenta de cobro no encontrada.");
          }
        } catch (error) {
          console.error("Error al cargar la cuenta:", error);
          alert("Error al generar el PDF.");
        }
      });
    });

    // Marcar pagada
    tablaCuentas.querySelectorAll(".btn-pagada").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const ok = confirm("¿Marcar esta cuenta como PAGADA?");
        if (!ok) return;
        await db.collection("cuentas").doc(id).update({ estado: "pagada" });
        await cargarCuentas();
      });
    });

  } catch (e) {
    console.error("Error cargando cuentas:", e);
  }
}

// ============================
// 🔹 Inicializar
// ============================
agregarItemBtn.addEventListener("click", () => agregarItem());

(async function init() {
  await cargarClientes();
  await cargarCuentas();

  // ── Corrector ortografía en tiempo real ──
  if (typeof ltActivar === "function") ltActivar();
  if (typeof ltObservar === "function") {
    ltObservar(document.getElementById("items-container"));
    ltObservar(document.getElementById("notas-vinetas-container"));
  }

  // Sistema de viñetas en notas
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
})();
