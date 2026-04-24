// js/contabilidad.js — Control Financiero Personal DOMKA
// ============================================================

// ── HELPERS ──────────────────────────────────────────────────
function fmt(n) {
  return `$${Number(n || 0).toLocaleString("es-CO")}`;
}

function toDate(v) {
  if (!v) return null;
  if (v.toDate) return v.toDate();
  return new Date(v);
}

function inRange(d, desde, hasta) {
  if (!d) return false;
  if (!desde && !hasta) return true;
  const t = d.getTime();
  if (desde && t < desde.getTime()) return false;
  if (hasta && t > new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), 23, 59, 59).getTime()) return false;
  return true;
}

function getRango() {
  const dv = document.getElementById("desde").value;
  const hv = document.getElementById("hasta").value;
  return {
    desde: dv ? new Date(dv) : null,
    hasta: hv ? new Date(hv) : null
  };
}

function mesKey(fecha) {
  const d = toDate(fecha);
  if (!d) return "0000-00";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mesLabel(key) {
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const [y, m] = key.split("-");
  return `${meses[parseInt(m) - 1]} ${y}`;
}

function hoy() {
  return new Date().toISOString().split("T")[0];
}

// ── ESTADO GLOBAL ─────────────────────────────────────────────
let _bancos       = [];
let _movimientos  = [];
let _cotizaciones = [];
let _cuentas      = [];
let _filtroMov    = "todos";
const charts = {};

// ── FETCH DATOS ───────────────────────────────────────────────
async function fetchAll() {
  const [cotSnap, cueSnap, movSnap, banSnap] = await Promise.all([
    db.collection("cotizaciones").orderBy("fecha", "desc").get(),
    db.collection("cuentas").orderBy("fecha", "desc").get(),
    db.collection("movimientos").orderBy("fecha", "desc").get().catch(() => ({ docs: [] })),
    db.collection("cuentasBancarias").orderBy("nombre").get().catch(() => ({ docs: [] }))
  ]);
  _cotizaciones = cotSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  _cuentas      = cueSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  _movimientos  = movSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  _bancos       = banSnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── TABS ──────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const panel = document.getElementById("tab-" + btn.dataset.tab);
    if (panel) panel.classList.add("active");
    if (btn.dataset.tab === "graficos") renderGraficos();
    if (btn.dataset.tab === "logs") renderLogs();
    if (btn.dataset.tab === "transacciones") renderTransacciones();
  });
});

// ── KPIs ──────────────────────────────────────────────────────
function calcularKPIs() {
  const { desde, hasta } = getRango();

  let totalIngresos = 0, totalGastos = 0, porCobrar = 0;
  let cotPend = 0, cotAprob = 0, cuePend = 0, cuePag = 0;

  for (const c of _cotizaciones) {
    const f = toDate(c.fecha);
    if (!inRange(f, desde, hasta)) continue;
    if (!c.estado || c.estado === "pendiente") cotPend++;
    else if (c.estado === "aprobada") cotAprob++;
  }

  for (const c of _cuentas) {
    const f = toDate(c.fecha);
    if (!inRange(f, desde, hasta)) continue;
    if (c.estado === "pagada") {
      cuePag++;
      totalIngresos += Number(c.total || 0);
    } else {
      cuePend++;
      porCobrar += Number(c.total || 0);
    }
  }

  for (const m of _movimientos) {
    const f = toDate(m.fecha);
    if (!inRange(f, desde, hasta)) continue;
    if (m.estado === "pendiente" || m.estado === "programado") continue;
    if (m.tipo === "ingreso") totalIngresos += Number(m.monto || 0);
    else if (m.tipo === "gasto") totalGastos += Number(m.monto || 0);
  }

  const balance = totalIngresos - totalGastos;
  const patrimonio = _bancos.reduce((a, b) => a + Number(b.saldo || 0), 0);

  set("kpi-ingresos", fmt(totalIngresos));
  set("kpi-gastos", fmt(totalGastos));
  set("kpi-patrimonio", fmt(patrimonio));
  set("kpi-por-cobrar", fmt(porCobrar));
  set("kpi-cot-pendientes", cotPend);
  set("kpi-cot-aprobadas", cotAprob);
  set("kpi-por-cobrar", fmt(porCobrar));
  set("kpi-cue-pagadas", cuePag);
  set("kpi-patrimonio", fmt(patrimonio));

  const balEl = document.getElementById("kpi-balance");
  if (balEl) {
    balEl.textContent = fmt(balance);
    balEl.className = `kpi-val ${balance >= 0 ? "text-blue-600" : "text-red-600"}`;
  }

  return { totalIngresos, totalGastos, balance, patrimonio };
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── CUENTAS BANCARIAS ─────────────────────────────────────────
let editandoBancoId = null;

function renderCuentasBancarias() {
  const lista = document.getElementById("lista-cuentas-bancarias");
  if (!lista) return;

  const patrimonio = _bancos.reduce((a, b) => a + Number(b.saldo || 0), 0);
  set("patrimonio-display", fmt(patrimonio));
  set("kpi-patrimonio", fmt(patrimonio));

  if (_bancos.length === 0) {
    lista.innerHTML = `
      <div class="col-span-2 text-center py-12 text-gray-400">
        <i class="fas fa-university text-4xl mb-3 block"></i>
        <p class="font-semibold">No hay cuentas registradas</p>
        <p class="text-sm mt-1">Agrega tu primera cuenta para empezar a gestionar tu dinero</p>
      </div>`;
    return;
  }

  const tipoIcono = {
    ahorros: "fa-piggy-bank", corriente: "fa-credit-card",
    digital: "fa-mobile-alt", efectivo: "fa-money-bill-wave",
    inversion: "fa-chart-line", credito: "fa-hand-holding-usd", otro: "fa-university"
  };

  lista.innerHTML = _bancos.map(b => {
    const color = b.color || "#f97316";
    const icono = tipoIcono[b.tipo] || "fa-university";
    const saldo = Number(b.saldo || 0);
    // calcular entradas y salidas de movimientos reales (excluir pendientes/programados)
    const movsBanco = _movimientos.filter(m => m.cuentaId === b.id && m.estado === "realizado");
    const entradas = movsBanco.filter(m => m.tipo === "ingreso").reduce((a, m) => a + Number(m.monto || 0), 0);
    const salidas  = movsBanco.filter(m => m.tipo === "gasto").reduce((a, m) => a + Number(m.monto || 0), 0);

    return `
      <div class="cuenta-card" style="background: linear-gradient(135deg, ${color}, ${color}cc)"
           onclick="mostrarDetalleCuenta('${b.id}')">
        <div class="relative z-10">
          <div class="flex justify-between items-start mb-4">
            <div>
              <p class="text-white/70 text-xs font-semibold uppercase tracking-wide">${b.tipo || "cuenta"}</p>
              <p class="font-bold text-white text-lg leading-tight mt-0.5">${b.nombre}</p>
              ${b.entidad ? `<p class="text-white/60 text-xs mt-0.5">${b.entidad}</p>` : ""}
              ${b.numero ? `<p class="text-white/50 text-xs font-mono mt-0.5">····${b.numero.slice(-4)}</p>` : ""}
            </div>
            <i class="fas ${icono} text-white/60 text-2xl"></i>
          </div>
          <div class="mb-4">
            <p class="text-white/70 text-xs">Saldo actual</p>
            <p class="text-white font-bold text-2xl">${fmt(saldo)}</p>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-white/15 rounded-lg p-2">
              <p class="text-white/70">Entradas (real.)</p>
              <p class="text-white font-bold">+${fmt(entradas)}</p>
            </div>
            <div class="bg-white/15 rounded-lg p-2">
              <p class="text-white/70">Salidas (real.)</p>
              <p class="text-white font-bold">-${fmt(salidas)}</p>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button onclick="event.stopPropagation(); editarBanco('${b.id}')"
              class="text-xs px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors">
              <i class="fas fa-edit mr-1"></i>Editar
            </button>
            <button onclick="event.stopPropagation(); eliminarBanco('${b.id}')"
              class="text-xs px-3 py-1 bg-red-500/40 hover:bg-red-500/60 text-white rounded-lg transition-colors">
              <i class="fas fa-trash mr-1"></i>Eliminar
            </button>
          </div>
        </div>
      </div>`;
  }).join("");
}

document.getElementById("btn-guardar-banco").addEventListener("click", async () => {
  const nombre = document.getElementById("banco-nombre").value.trim();
  if (!nombre) { alert("Ingresa el nombre de la cuenta"); return; }

  const data = {
    nombre,
    entidad: document.getElementById("banco-entidad").value.trim(),
    tipo:    document.getElementById("banco-tipo").value,
    numero:  document.getElementById("banco-numero").value.trim(),
    saldo:   Number(document.getElementById("banco-saldo").value) || 0,
    color:   document.getElementById("banco-color").value,
    actualizadoEn: new Date()
  };

  if (editandoBancoId) {
    await db.collection("cuentasBancarias").doc(editandoBancoId).update(data);
    editandoBancoId = null;
  } else {
    data.creadoEn = new Date();
    await db.collection("cuentasBancarias").add(data);
  }

  limpiarFormBanco();
  await fetchAll();
  renderCuentasBancarias();
  poblarSelectCuentas();
  calcularKPIs();
  alert("✅ Cuenta guardada");
});

function limpiarFormBanco() {
  document.getElementById("banco-id-editando").value = "";
  document.getElementById("banco-nombre").value = "";
  document.getElementById("banco-entidad").value = "";
  document.getElementById("banco-numero").value = "";
  document.getElementById("banco-saldo").value = 0;
  document.getElementById("banco-color").value = "#f97316";
  document.getElementById("banco-tipo").value = "ahorros";
  document.getElementById("titulo-form-banco").textContent = "Agregar Cuenta";
  document.getElementById("btn-cancelar-banco").classList.add("hidden");
  editandoBancoId = null;
}

window.editarBanco = function(id) {
  const b = _bancos.find(x => x.id === id);
  if (!b) return;
  document.getElementById("banco-id-editando").value = id;
  document.getElementById("banco-nombre").value = b.nombre || "";
  document.getElementById("banco-entidad").value = b.entidad || "";
  document.getElementById("banco-tipo").value = b.tipo || "ahorros";
  document.getElementById("banco-numero").value = b.numero || "";
  document.getElementById("banco-saldo").value = b.saldo || 0;
  document.getElementById("banco-color").value = b.color || "#f97316";
  document.getElementById("titulo-form-banco").textContent = "Editar Cuenta";
  document.getElementById("btn-cancelar-banco").classList.remove("hidden");
  editandoBancoId = id;
  document.getElementById("banco-nombre").scrollIntoView({ behavior: "smooth" });
};

window.eliminarBanco = async function(id) {
  if (!confirm("¿Eliminar esta cuenta? Los movimientos asociados no se eliminarán.")) return;
  await db.collection("cuentasBancarias").doc(id).delete();
  await fetchAll();
  renderCuentasBancarias();
  poblarSelectCuentas();
  calcularKPIs();
};

document.getElementById("btn-cancelar-banco").addEventListener("click", limpiarFormBanco);

// Detalle de cuenta al hacer click
window.mostrarDetalleCuenta = function(id) {
  const b = _bancos.find(x => x.id === id);
  if (!b) return;
  const wrap = document.getElementById("detalle-cuenta-wrap");
  const titulo = document.getElementById("detalle-cuenta-titulo");
  const contenido = document.getElementById("detalle-cuenta-contenido");

  titulo.textContent = `Movimientos — ${b.nombre}`;
  wrap.classList.remove("hidden");

  const movs = _movimientos
    .filter(m => m.cuentaId === id)
    .sort((a, z) => (toDate(z.fecha) || 0) - (toDate(a.fecha) || 0));

  if (movs.length === 0) {
    contenido.innerHTML = `<p class="text-gray-400 text-sm text-center py-6">Sin movimientos en esta cuenta.</p>`;
    wrap.scrollIntoView({ behavior: "smooth" });
    return;
  }

  let sumIng = 0, sumGas = 0;
  movs.forEach(m => {
    if (m.tipo === "ingreso" && m.estado === "realizado") sumIng += Number(m.monto || 0);
    if (m.tipo === "gasto"   && m.estado === "realizado") sumGas += Number(m.monto || 0);
  });

  contenido.innerHTML = `
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="bg-green-50 rounded-xl p-3 text-center">
        <p class="text-xs text-green-600 font-semibold">Entradas realizadas</p>
        <p class="font-bold text-green-700">+${fmt(sumIng)}</p>
      </div>
      <div class="bg-red-50 rounded-xl p-3 text-center">
        <p class="text-xs text-red-500 font-semibold">Salidas realizadas</p>
        <p class="font-bold text-red-600">-${fmt(sumGas)}</p>
      </div>
      <div class="bg-blue-50 rounded-xl p-3 text-center">
        <p class="text-xs text-blue-500 font-semibold">Saldo en cuenta</p>
        <p class="font-bold text-blue-600">${fmt(b.saldo)}</p>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="border-b">
          <tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Estado</th><th class="text-right">Monto</th><th></th></tr>
        </thead>
        <tbody>
          ${movs.map(m => {
            const f = toDate(m.fecha);
            const esI = m.tipo === "ingreso";
            const estadoBadge = {
              realizado: "badge-green", pendiente: "badge-yellow", programado: "badge-blue"
            }[m.estado || "realizado"] || "badge-gray";
            return `<tr>
              <td class="text-xs text-gray-500">${f ? f.toLocaleDateString("es-CO") : "—"}</td>
              <td><span class="font-medium">${m.descripcion || "—"}</span>${m.notas ? `<p class="text-xs text-gray-400">${m.notas}</p>` : ""}</td>
              <td class="text-xs text-gray-500 capitalize">${m.categoria || "general"}</td>
              <td><span class="badge ${estadoBadge}">${m.estado || "realizado"}</span></td>
              <td class="text-right font-bold ${esI ? "text-green-600" : "text-red-500"}">${esI ? "+" : "−"}${fmt(m.monto)}</td>
              <td><button onclick="eliminarMovimiento('${m.id}')" class="text-red-400 hover:text-red-600 text-xs px-2">✕</button></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;

  wrap.scrollIntoView({ behavior: "smooth" });
};

document.getElementById("btn-cerrar-detalle").addEventListener("click", () => {
  document.getElementById("detalle-cuenta-wrap").classList.add("hidden");
});

// ── MOVIMIENTOS ───────────────────────────────────────────────
function poblarSelectCuentas() {
  const sel = document.getElementById("mov-cuenta-bancaria");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Sin asignar</option>';
  _bancos.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.nombre;
    if (b.id === prev) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderMovimientos() {
  const { desde, hasta } = getRango();
  const lista = document.getElementById("lista-movimientos");
  if (!lista) return;

  let movs = _movimientos.filter(m => {
    const f = toDate(m.fecha);
    return inRange(f, desde, hasta);
  });

  // Aplicar filtro de tipo
  if (_filtroMov !== "todos") {
    if (_filtroMov === "pendiente") {
      movs = movs.filter(m => m.estado === "pendiente" || m.estado === "programado");
    } else {
      movs = movs.filter(m => m.tipo === _filtroMov);
    }
  }

  // Mini resumen
  const ing = movs.filter(m => m.tipo === "ingreso" && m.estado === "realizado")
    .reduce((a, m) => a + Number(m.monto || 0), 0);
  const gas = movs.filter(m => m.tipo === "gasto" && m.estado === "realizado")
    .reduce((a, m) => a + Number(m.monto || 0), 0);
  set("mov-sum-ing", fmt(ing));
  set("mov-sum-gas", fmt(gas));
  const balEl = document.getElementById("mov-bal");
  if (balEl) {
    const bal = ing - gas;
    balEl.textContent = fmt(bal);
    balEl.className = `font-bold text-lg ${bal >= 0 ? "text-blue-600" : "text-red-500"}`;
  }

  if (movs.length === 0) {
    lista.innerHTML = `<p class="text-gray-400 text-sm text-center py-8">No hay movimientos en este período</p>`;
    return;
  }

  const banco = id => _bancos.find(b => b.id === id);
  const estadoColor = { realizado: "badge-green", pendiente: "badge-yellow", programado: "badge-blue" };

  lista.innerHTML = movs.map(m => {
    const f = toDate(m.fecha);
    const esI = m.tipo === "ingreso";
    const b = banco(m.cuentaId);
    const esc = estadoColor[m.estado || "realizado"] || "badge-gray";
    return `
      <div class="mov-row ${esI ? "ingreso" : "gasto"} ${m.estado === "pendiente" || m.estado === "programado" ? "pendiente" : ""}">
        <div class="flex justify-between items-start gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span class="font-semibold text-sm text-gray-800 truncate">${m.descripcion || "Sin descripción"}</span>
              <span class="badge ${esI ? "badge-green" : "badge-red"}">${esI ? "Ingreso" : "Gasto"}</span>
              <span class="badge badge-gray">${m.categoria || "general"}</span>
              <span class="badge ${esc}">${m.estado || "realizado"}</span>
            </div>
            <div class="flex gap-3 flex-wrap text-xs text-gray-400 mt-0.5">
              ${f ? `<span><i class="fas fa-calendar-alt mr-1"></i>${f.toLocaleDateString("es-CO")}</span>` : ""}
              ${b ? `<span><i class="fas fa-university mr-1"></i>${b.nombre}</span>` : ""}
              ${m.notas ? `<span class="italic">${m.notas}</span>` : ""}
            </div>
          </div>
          <div class="shrink-0 text-right">
            <p class="font-bold text-base ${esI ? "text-green-700" : "text-red-600"}">${esI ? "+" : "−"}${fmt(m.monto)}</p>
            <button onclick="eliminarMovimiento('${m.id}')" class="text-red-400 hover:text-red-600 text-xs mt-1 px-1">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join("");
}

document.getElementById("btn-guardar-mov").addEventListener("click", async () => {
  const tipo        = document.querySelector('input[name="tipo-mov"]:checked').value;
  const descripcion = document.getElementById("mov-descripcion").value.trim();
  const monto       = Number(document.getElementById("mov-monto").value) || 0;
  const fechaVal    = document.getElementById("mov-fecha").value;
  const cuentaId    = document.getElementById("mov-cuenta-bancaria").value;
  const categoria   = document.getElementById("mov-categoria").value;
  const estado      = document.getElementById("mov-estado").value;
  const notas       = document.getElementById("mov-notas").value.trim();

  if (!descripcion) { alert("Ingresa una descripción"); return; }
  if (monto <= 0)   { alert("Ingresa un monto válido"); return; }

  const cuentaNombre = cuentaId
    ? (_bancos.find(b => b.id === cuentaId)?.nombre || "")
    : "";

  await db.collection("movimientos").add({
    tipo, descripcion, monto, categoria, estado, notas,
    cuentaId: cuentaId || null,
    cuentaNombre,
    fecha: fechaVal ? new Date(fechaVal + "T12:00:00") : new Date(),
    creadoEn: new Date()
  });

  // Si el movimiento es "realizado" y tiene cuenta, actualizar saldo de la cuenta
  if (estado === "realizado" && cuentaId) {
    try {
      const bd = await db.collection("cuentasBancarias").doc(cuentaId).get();
      if (bd.exists) {
        const saldoActual = Number(bd.data().saldo || 0);
        const nuevoSaldo = tipo === "ingreso" ? saldoActual + monto : saldoActual - monto;
        await db.collection("cuentasBancarias").doc(cuentaId).update({ saldo: nuevoSaldo });
      }
    } catch (e) { console.warn("No se pudo actualizar saldo:", e); }
  }

  // Limpiar form
  document.getElementById("mov-descripcion").value = "";
  document.getElementById("mov-monto").value = "";
  document.getElementById("mov-notas").value = "";
  document.getElementById("mov-fecha").value = hoy();
  document.getElementById("mov-cuenta-bancaria").value = "";
  document.getElementById("mov-categoria").value = "general";
  document.getElementById("mov-estado").value = "realizado";
  document.querySelector('input[name="tipo-mov"][value="ingreso"]').checked = true;
  actualizarEstilosTipoMov();

  await fetchAll();
  renderMovimientos();
  renderCuentasBancarias();
  calcularKPIs();
  alert("✅ Movimiento guardado");
});

window.eliminarMovimiento = async function(id) {
  if (!confirm("¿Eliminar este movimiento? El saldo de la cuenta NO se revertirá automáticamente.")) return;
  await db.collection("movimientos").doc(id).delete();
  await fetchAll();
  renderMovimientos();
  renderCuentasBancarias();
  calcularKPIs();
};

// Estilos visuales al cambiar tipo ingreso/gasto
function actualizarEstilosTipoMov() {
  const esIngreso = document.querySelector('input[name="tipo-mov"]:checked').value === "ingreso";
  const lI = document.getElementById("lbl-tipo-ingreso");
  const lG = document.getElementById("lbl-tipo-gasto");
  if (lI) {
    lI.className = `flex items-center gap-2 border-2 rounded-lg p-3 cursor-pointer ${esIngreso ? "border-green-400 bg-green-50" : "border-gray-200 bg-white"}`;
  }
  if (lG) {
    lG.className = `flex items-center gap-2 border-2 rounded-lg p-3 cursor-pointer ${!esIngreso ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"}`;
  }
}

document.querySelectorAll('input[name="tipo-mov"]').forEach(r => {
  r.addEventListener("change", actualizarEstilosTipoMov);
});

// Filtros de movimientos
document.querySelectorAll(".filtro-mov-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    _filtroMov = btn.dataset.filtro;
    renderMovimientos();
  });
});

// ── GRÁFICOS ──────────────────────────────────────────────────
function drawChart(id, type, data, options = {}) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(canvas, {
    type,
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { font: { size: 11 } } } },
      ...options
    }
  });
}

function renderGraficos() {
  const { desde, hasta } = getRango();

  // ── 1. Ingresos vs Gastos por mes (barras) ──
  const mesesMap = {};

  for (const m of _movimientos) {
    if (m.estado === "pendiente" || m.estado === "programado") continue;
    const f = toDate(m.fecha);
    if (!inRange(f, desde, hasta)) continue;
    const k = mesKey(f);
    if (!mesesMap[k]) mesesMap[k] = { ing: 0, gas: 0 };
    if (m.tipo === "ingreso") mesesMap[k].ing += Number(m.monto || 0);
    else mesesMap[k].gas += Number(m.monto || 0);
  }

  for (const c of _cuentas) {
    if (c.estado !== "pagada") continue;
    const f = toDate(c.fecha);
    if (!inRange(f, desde, hasta)) continue;
    const k = mesKey(f);
    if (!mesesMap[k]) mesesMap[k] = { ing: 0, gas: 0 };
    mesesMap[k].ing += Number(c.total || 0);
  }

  const mesesOrd = Object.keys(mesesMap).sort();

  drawChart("chart-ig", "bar", {
    labels: mesesOrd.length ? mesesOrd.map(mesLabel) : ["Sin datos"],
    datasets: [
      { label: "Ingresos", data: mesesOrd.map(k => mesesMap[k].ing), backgroundColor: "rgba(34,197,94,.75)", borderRadius: 6 },
      { label: "Gastos",   data: mesesOrd.map(k => mesesMap[k].gas), backgroundColor: "rgba(239,68,68,.75)",  borderRadius: 6 }
    ]
  }, {
    scales: { y: { beginAtZero: true, ticks: { callback: v => `$${Number(v).toLocaleString("es-CO")}` } } }
  });

  // ── 2. Evolución del balance (línea) ──
  let balAcum = 0;
  const balData = mesesOrd.map(k => {
    balAcum += mesesMap[k].ing - mesesMap[k].gas;
    return balAcum;
  });

  drawChart("chart-balance", "line", {
    labels: mesesOrd.length ? mesesOrd.map(mesLabel) : ["Sin datos"],
    datasets: [{
      label: "Balance acumulado",
      data: balData,
      borderColor: "#3b82f6",
      backgroundColor: "rgba(59,130,246,.1)",
      fill: true,
      tension: 0.35,
      pointRadius: 4
    }]
  }, {
    scales: { y: { ticks: { callback: v => `$${Number(v).toLocaleString("es-CO")}` } } }
  });

  // ── 3. Gastos por categoría (dona) ──
  const catMap = {};
  for (const m of _movimientos) {
    if (m.tipo !== "gasto" || m.estado === "pendiente" || m.estado === "programado") continue;
    const f = toDate(m.fecha);
    if (!inRange(f, desde, hasta)) continue;
    const cat = m.categoria || "general";
    catMap[cat] = (catMap[cat] || 0) + Number(m.monto || 0);
  }
  const catLabels = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]);
  const catColors = ["#f97316","#ef4444","#8b5cf6","#3b82f6","#10b981","#f59e0b","#06b6d4","#ec4899","#84cc16","#6366f1"];

  drawChart("chart-cat", "doughnut", {
    labels: catLabels.length ? catLabels : ["Sin gastos"],
    datasets: [{
      data: catLabels.length ? catLabels.map(k => catMap[k]) : [1],
      backgroundColor: catColors,
      borderWidth: 2
    }]
  });

  // ── 4. Saldo por cuenta bancaria (barras horizontales) ──
  drawChart("chart-bancos", "bar", {
    labels: _bancos.length ? _bancos.map(b => b.nombre) : ["Sin cuentas"],
    datasets: [{
      label: "Saldo actual",
      data: _bancos.length ? _bancos.map(b => Number(b.saldo || 0)) : [0],
      backgroundColor: _bancos.length ? _bancos.map(b => b.color || "#f97316") : ["#d1d5db"],
      borderRadius: 6
    }]
  }, {
    indexAxis: "y",
    scales: { x: { beginAtZero: true, ticks: { callback: v => `$${Number(v).toLocaleString("es-CO")}` } } },
    plugins: { legend: { display: false } }
  });

  // ── 5. Gastos mensuales (línea acumulada) ──
  let gasAcum = 0;
  const gasLineData = mesesOrd.map(k => {
    gasAcum += mesesMap[k].gas;
    return gasAcum;
  });

  drawChart("chart-gastos-linea", "line", {
    labels: mesesOrd.length ? mesesOrd.map(mesLabel) : ["Sin datos"],
    datasets: [{
      label: "Gastos acumulados",
      data: gasLineData,
      borderColor: "#ef4444",
      backgroundColor: "rgba(239,68,68,.1)",
      fill: true,
      tension: 0.35,
      pointRadius: 4,
      pointBackgroundColor: "#ef4444"
    }]
  }, {
    scales: { y: { beginAtZero: true, ticks: { callback: v => `$${Number(v).toLocaleString("es-CO")}` } } }
  });
}

// ── TRANSACCIONES (vista global) ──────────────────────────────
function renderTransacciones() {
  const { desde, hasta } = getRango();
  const tbody = document.getElementById("tbody-trans");
  const countEl = document.getElementById("trans-count");
  if (!tbody) return;

  const trans = [];

  for (const c of _cotizaciones) {
    const f = toDate(c.fecha);
    if (!inRange(f, desde, hasta)) continue;
    trans.push({ tipo: "Cotización", desc: c.nombreCliente || "—", monto: c.total || 0, esI: c.estado === "aprobada", cat: "cotización", cuenta: "", f, estado: c.estado || "pendiente" });
  }
  for (const c of _cuentas) {
    const f = toDate(c.fecha);
    if (!inRange(f, desde, hasta)) continue;
    trans.push({ tipo: "Cuenta Cobro", desc: c.nombreCliente || "—", monto: c.total || 0, esI: c.estado === "pagada", cat: "cuenta cobro", cuenta: "", f, estado: c.estado || "pendiente" });
  }
  for (const m of _movimientos) {
    const f = toDate(m.fecha);
    if (!inRange(f, desde, hasta)) continue;
    const b = _bancos.find(x => x.id === m.cuentaId);
    trans.push({ tipo: m.tipo === "ingreso" ? "Ingreso" : "Gasto", desc: m.descripcion || "—", monto: m.monto || 0, esI: m.tipo === "ingreso", cat: m.categoria || "general", cuenta: b?.nombre || "", f, estado: m.estado || "realizado" });
  }

  trans.sort((a, b) => (b.f || 0) - (a.f || 0));

  if (countEl) countEl.textContent = `${trans.length} registros`;
  document.getElementById("empty-trans").classList.toggle("hidden", trans.length > 0);

  const estadoC = (e) => ({ pagada:"badge-green", aprobada:"badge-green", realizado:"badge-green", pendiente:"badge-yellow", programado:"badge-blue", rechazada:"badge-red" }[e] || "badge-gray");

  tbody.innerHTML = trans.map(t => `
    <tr>
      <td class="text-xs text-gray-500">${t.tipo}</td>
      <td class="font-medium">${t.desc}</td>
      <td class="text-right font-bold ${t.esI ? "text-green-600" : "text-red-500"}">${t.esI ? "+" : "−"}${fmt(t.monto)}</td>
      <td class="text-xs text-gray-400 capitalize">${t.cat}</td>
      <td class="text-xs text-gray-400">${t.cuenta}</td>
      <td class="text-xs text-gray-400">${t.f ? t.f.toLocaleDateString("es-CO") : "—"}</td>
      <td><span class="badge ${estadoC(t.estado)}">${t.estado}</span></td>
    </tr>
  `).join("");

  window._export_data = trans;
}

// ── LOGS ──────────────────────────────────────────────────────
async function renderLogs() {
  const snap = await db.collection("logs").orderBy("timestamp", "desc").limit(100).get().catch(() => ({ docs: [] }));
  const tbody = document.getElementById("tbody-logs");
  const countEl = document.getElementById("logs-count");
  const emptyEl = document.getElementById("empty-logs");
  tbody.innerHTML = "";

  const labels = {
    "vista": "👁 Vista",
    "recibido_confirmado": "✅ Recibido",
    "firma_guardada_exitosamente": "✍️ Firmado",
    "modal_recomendacion_mostrado": "💬 Modal"
  };

  if (snap.docs.length === 0) {
    emptyEl.classList.remove("hidden");
    if (countEl) countEl.textContent = "0 registros";
    return;
  }

  emptyEl.classList.add("hidden");
  if (countEl) countEl.textContent = `${snap.docs.length} registros`;

  snap.docs.forEach(d => {
    const log = d.data();
    const fecha = log.timestamp ? log.timestamp.toDate().toLocaleString("es-CO") : "—";
    const accion = labels[log.accion || log.event] || log.accion || log.event || "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="font-medium">${accion}</td>
      <td class="capitalize text-xs text-gray-500">${log.tipo || "—"}</td>
      <td class="text-sm">${log.nombreCliente || "—"}</td>
      <td class="text-right text-sm">${log.total ? fmt(log.total) : "—"}</td>
      <td class="text-xs text-gray-400">${log.city || "—"}</td>
      <td class="text-xs text-gray-400">${fecha}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── EXPORTAR CSV ──────────────────────────────────────────────
document.getElementById("btn-export").addEventListener("click", () => {
  const data = window._export_data || [];
  if (!data.length) { alert("Ve al tab Transacciones primero y vuelve a exportar."); return; }

  const rows = [
    ["Tipo","Descripción/Cliente","Monto","Ingreso o Gasto","Categoría","Cuenta","Fecha","Estado"],
    ...data.map(t => [t.tipo, t.desc, t.monto, t.esI ? "Ingreso" : "Gasto", t.cat, t.cuenta, t.f ? t.f.toLocaleDateString("es-CO") : "", t.estado])
  ];
  const csv = rows.map(r => r.map(c => `"${String(c || "").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finanzas_DOMKA_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

// ── FILTRAR / LIMPIAR ─────────────────────────────────────────
document.getElementById("btn-filtrar").addEventListener("click", async () => {
  calcularKPIs();
  renderMovimientos();
  renderTransacciones();
  // Si el tab de gráficos está activo, re-renderizar
  if (document.getElementById("tab-graficos").classList.contains("active")) renderGraficos();
});

document.getElementById("btn-limpiar").addEventListener("click", () => {
  document.getElementById("desde").value = "";
  document.getElementById("hasta").value = "";
  calcularKPIs();
  renderMovimientos();
  renderTransacciones();
});

// ── INIT ──────────────────────────────────────────────────────
document.getElementById("mov-fecha").value = hoy();

(async function init() {
  await fetchAll();
  calcularKPIs();
  renderCuentasBancarias();
  poblarSelectCuentas();
  renderMovimientos();
  renderTransacciones();
})();
