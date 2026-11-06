// js/contabilidad-libro.js — Libro contable DOMKA: Cuentas T, Balance y Plan de cuentas
// ============================================================
// Colecciones nuevas (Firestore):
//   planCuentas/{codigo}  → { codigo, nombre, clase, naturaleza, categorias[], activa, origen }
//   asientos/{id}         → { fecha, descripcion, origen{tipo,id}, lineas[{codigo,nombre,debe,haber}],
//                             totalDebe, totalHaber, creadoEn, creadoPor }   (inmutables)
// Campos nuevos en movimientos: cuentaContable, asientoId, asientoEstado, asientoMotivo
// Campo nuevo en cuentasBancarias: cuentaContable (ej. 1110)
// ============================================================
(() => {
  "use strict";

  // ── UTILIDADES ─────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fm = n => `$${Math.round(Number(n || 0)).toLocaleString("es-CO")}`;
  const toD = v => (!v ? null : (v.toDate ? v.toDate() : new Date(v)));
  const fechaCorta = d => (d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");
  const hoyISO = () => new Date().toISOString().slice(0, 10);
  const inicioDia = v => (v ? new Date(v + "T00:00:00") : null);
  const finDia = v => (v ? new Date(v + "T23:59:59") : null);
  const usuario = () => (window.auth && auth.currentUser && auth.currentUser.email) || null;
  const natDefault = cod => (["1", "5", "6", "7"].includes(String(cod)[0]) ? "debito" : "credito");

  const CLASES = {
    1: "Activo", 2: "Pasivo", 3: "Patrimonio", 4: "Ingresos",
    5: "Gastos", 6: "Costos de ventas", 7: "Costos de producción / obra"
  };

  // ── PUC BASE (simplificado, inspirado en el PUC colombiano — Decreto 2650/1993) ──
  // [codigo, nombre, naturaleza opcional si es contraria a su clase]
  const PUC_BASE = [
    ["1105", "Caja"], ["1110", "Bancos"], ["1120", "Cuentas de ahorro"],
    ["1305", "Clientes"], ["1330", "Anticipos y avances"],
    ["1355", "Anticipo de impuestos y contribuciones o saldos a favor"], ["1380", "Deudores varios"],
    ["1410", "Productos en proceso (obras en curso)"], ["1435", "Mercancías no fabricadas por la empresa"],
    ["1504", "Terrenos"], ["1516", "Construcciones y edificaciones"], ["1520", "Maquinaria y equipo"],
    ["1524", "Equipo de oficina"], ["1528", "Equipo de computación y comunicación"],
    ["1540", "Flota y equipo de transporte"], ["1592", "Depreciación acumulada", "credito"],
    ["2105", "Obligaciones financieras (bancos nacionales)"], ["2205", "Proveedores nacionales"],
    ["2335", "Costos y gastos por pagar"], ["2365", "Retención en la fuente"],
    ["2367", "Impuesto a las ventas retenido"], ["2368", "Impuesto de industria y comercio retenido"],
    ["2370", "Retenciones y aportes de nómina"], ["2404", "Impuesto de renta y complementarios"],
    ["2408", "Impuesto sobre las ventas por pagar"], ["2505", "Salarios por pagar"],
    ["2510", "Cesantías consolidadas"], ["2805", "Anticipos y avances recibidos"],
    ["3105", "Capital suscrito y pagado"], ["3305", "Reservas obligatorias"],
    ["3705", "Utilidades acumuladas"], ["3710", "Pérdidas acumuladas", "debito"],
    ["4130", "Construcción"], ["4135", "Comercio al por mayor y al por menor"],
    ["4155", "Actividades inmobiliarias, empresariales y de alquiler"],
    ["4170", "Otras actividades de servicios"], ["4175", "Devoluciones, rebajas y descuentos en ventas", "debito"],
    ["4210", "Ingresos financieros"], ["4220", "Arrendamientos (no operacionales)"],
    ["4250", "Recuperaciones"], ["4295", "Ingresos diversos"],
    ["5105", "Gastos de personal"], ["5110", "Honorarios"], ["5115", "Impuestos"],
    ["5120", "Arrendamientos"], ["5125", "Contribuciones y afiliaciones"], ["5130", "Seguros"],
    ["5135", "Servicios"], ["5140", "Gastos legales"], ["5145", "Mantenimiento y reparaciones"],
    ["5155", "Gastos de viaje"], ["5160", "Depreciaciones"], ["5195", "Gastos diversos"],
    ["5235", "Gastos de ventas — servicios (publicidad)"],
    ["5305", "Gastos financieros"], ["5315", "Gastos extraordinarios"], ["5395", "Gastos diversos no operacionales"],
    ["6135", "Costo de ventas — comercio"],
    ["7105", "Materiales de obra (materia prima)"], ["7205", "Mano de obra directa"],
    ["7305", "Costos indirectos de obra"], ["7405", "Subcontratos de obra (contratos de servicios)"]
  ];

  // categoría del formulario de movimientos → cuenta contable por defecto
  const CAT_DEFAULT = {
    "servicios-prestados": "4130", "freelance": "4130", "ventas": "4135",
    "arriendo-recibido": "4220", "rendimiento": "4210",
    "vivienda": "5120", "servicios-publicos": "5135", "transporte": "5155", "tecnologia": "5135",
    "materiales": "7105", "nomina": "5105", "publicidad": "5235", "impuestos": "5115", "deudas": "2105",
    "alimentacion": "5195", "salud": "5195", "educacion": "5195", "entretenimiento": "5195", "ropa": "5195"
  };

  // cuenta contable por defecto según tipo de cuenta bancaria
  const BANCO_DEFAULT = { efectivo: "1105", ahorros: "1120", corriente: "1110", digital: "1110", inversion: "1110", credito: "2105", otro: "1110" };

  // ── ESTADO ─────────────────────────────────────────────────
  const S = { plan: [], planMap: {}, planLoaded: false, asientos: [], asientoIds: new Set(), movs: [], bancos: [], bancosLoaded: false };

  const codigoBanco = b => (b && b.cuentaContable) || BANCO_DEFAULT[b && b.tipo] || "1110";

  function cuentaPorCategoria(cat) {
    if (!cat) return null;
    const a = S.plan.find(x => x.activa !== false && (x.categorias || []).includes(cat));
    return a ? a.codigo : null;
  }

  // ── CARGA DE DATOS ─────────────────────────────────────────
  async function loadPlan() {
    const snap = await db.collection("planCuentas").orderBy("codigo").get();
    S.plan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    S.planMap = Object.fromEntries(S.plan.map(a => [a.codigo, a]));
    S.planLoaded = true;
  }
  async function ensurePlan() { if (!S.planLoaded) await loadPlan(); }

  async function loadBancos() {
    const snap = await db.collection("cuentasBancarias").orderBy("nombre").get().catch(() => ({ docs: [] }));
    S.bancos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    S.bancosLoaded = true;
  }

  async function loadAll() {
    const [, asSnap, movSnap] = await Promise.all([
      loadPlan(),
      db.collection("asientos").orderBy("fecha", "asc").get().catch(() => ({ docs: [] })),
      db.collection("movimientos").orderBy("fecha", "desc").get().catch(() => ({ docs: [] })),
      loadBancos()
    ]);
    S.asientos = asSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    S.asientoIds = new Set(S.asientos.map(a => a.id));
    S.movs = movSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ── MAYOR (saldos por cuenta) ──────────────────────────────
  function mayor({ desde = null, hasta = null } = {}) {
    const m = {};
    const get = c => (m[c] ||= { codigo: c, antDebe: 0, antHaber: 0, debe: 0, haber: 0, lineas: [] });
    for (const a of S.asientos) {
      const f = toD(a.fecha);
      if (hasta && f > hasta) continue;
      for (const l of a.lineas || []) {
        const r = get(l.codigo);
        const d = Number(l.debe || 0), h = Number(l.haber || 0);
        if (desde && f < desde) { r.antDebe += d; r.antHaber += h; continue; }
        r.debe += d; r.haber += h;
        r.lineas.push({ fecha: f, desc: a.descripcion, debe: d, haber: h, asientoId: a.id });
      }
    }
    return m;
  }

  // ── RESOLVER ASIENTO DE UN MOVIMIENTO ──────────────────────
  // Devuelve { asiento, contra } si puede registrarse, o { motivo } si no.
  function resolver(id, mov, bank) {
    const estado = mov.estado || "realizado";
    if (estado !== "realizado") return { motivo: `Estado “${estado}”: entra al libro cuando se realice` };
    if (mov.tipo !== "ingreso" && mov.tipo !== "gasto") return { motivo: "Tipo de movimiento no reconocido" };
    const monto = Number(mov.monto || 0);
    if (!(monto > 0)) return { motivo: "Monto inválido" };
    if (!S.plan.length) return { motivo: "Plan de cuentas vacío (cárgalo en la pestaña Plan de cuentas)" };
    if (!mov.cuentaId) return { motivo: "Sin cuenta bancaria asignada" };
    if (!bank) return { motivo: "La cuenta bancaria ya no existe" };
    const codBanco = codigoBanco(bank);
    if (!S.planMap[codBanco]) return { motivo: `La cuenta ${codBanco} (de “${bank.nombre}”) no existe en el plan`, vinculaBanco: true };
    const contra = mov.cuentaContable || cuentaPorCategoria(mov.categoria);
    if (!contra) return { motivo: "Sin cuenta contable: elige a dónde va", necesitaContra: true };
    if (!S.planMap[contra]) return { motivo: `La cuenta contable ${contra} no existe en el plan`, necesitaContra: true };
    if (contra === codBanco) return { motivo: "La cuenta contable no puede ser la misma del banco", necesitaContra: true };

    const esIng = mov.tipo === "ingreso";
    const lB = { codigo: codBanco, nombre: S.planMap[codBanco].nombre, debe: esIng ? monto : 0, haber: esIng ? 0 : monto };
    const lC = { codigo: contra, nombre: S.planMap[contra].nombre, debe: esIng ? 0 : monto, haber: esIng ? monto : 0 };
    return {
      contra,
      asiento: {
        fecha: toD(mov.fecha) || new Date(),
        descripcion: mov.descripcion || "Movimiento",
        origen: { tipo: "movimiento", id },
        lineas: esIng ? [lB, lC] : [lC, lB],
        totalDebe: monto, totalHaber: monto,
        creadoEn: new Date(), creadoPor: usuario()
      }
    };
  }

  async function obtenerBanco(id) {
    if (!id) return null;
    let b = S.bancos.find(x => x.id === id);
    if (b) return b;
    const d = await db.collection("cuentasBancarias").doc(id).get();
    return d.exists ? { id: d.id, ...d.data() } : null;
  }

  // ── API: REGISTRAR / REVERTIR MOVIMIENTOS ──────────────────
  // opts.marcarRealizado → pasa el movimiento a "realizado", ajusta saldo del banco y registra el asiento
  async function registrarMovimiento(id, mov, opts = {}) {
    await ensurePlan();
    const ref = db.collection("movimientos").doc(id);
    const movEf = opts.marcarRealizado ? { ...mov, estado: "realizado" } : mov;
    const bank = await obtenerBanco(movEf.cuentaId);
    const r = resolver(id, movEf, bank);

    if (r.motivo) {
      await ref.update({ asientoEstado: "omitido", asientoMotivo: r.motivo }).catch(() => {});
      return { ok: false, motivo: r.motivo };
    }
    const asId = "mov_" + id;
    if (S.asientoIds.has(asId)) return { ok: true, yaExistia: true };

    const batch = db.batch();
    batch.set(db.collection("asientos").doc(asId), r.asiento);
    const upd = {
      asientoId: asId, asientoEstado: "generado", cuentaContable: r.contra,
      asientoMotivo: firebase.firestore.FieldValue.delete()
    };
    if (opts.marcarRealizado) {
      upd.estado = "realizado";
      const monto = Number(movEf.monto || 0);
      batch.update(db.collection("cuentasBancarias").doc(movEf.cuentaId), {
        saldo: firebase.firestore.FieldValue.increment(movEf.tipo === "ingreso" ? monto : -monto)
      });
    }
    batch.update(ref, upd);
    await batch.commit();
    S.asientoIds.add(asId);
    return { ok: true };
  }

  // Llamar ANTES de borrar un movimiento: crea el contra-asiento (los asientos no se borran)
  async function revertirMovimiento(mov) {
    if (!mov || !mov.asientoId) return;
    const orig = await db.collection("asientos").doc(mov.asientoId).get();
    if (!orig.exists) return;
    const revId = "rev_" + mov.id;
    const ya = await db.collection("asientos").doc(revId).get();
    if (ya.exists) return;
    const a = orig.data();
    await db.collection("asientos").doc(revId).set({
      fecha: new Date(),
      descripcion: `Reversión: ${a.descripcion}`,
      origen: { tipo: "reversion", id: mov.id, asientoId: orig.id },
      lineas: (a.lineas || []).map(l => ({ ...l, debe: l.haber, haber: l.debe })),
      totalDebe: a.totalHaber, totalHaber: a.totalDebe,
      creadoEn: new Date(), creadoPor: usuario()
    });
    S.asientoIds.add(revId);
  }

  // ── FORMULARIO DE MOVIMIENTOS (select "a dónde va") ────────
  function tipoMovActual() {
    const r = document.querySelector('input[name="tipo-mov"]:checked');
    return r ? r.value : "ingreso";
  }

  function opcionesContra(tipo, valor) {
    const orden = tipo === "ingreso" ? [4, 2, 3, 1, 5, 6, 7] : [5, 7, 6, 2, 1, 3, 4];
    let html = `<option value="">Automática (según categoría)</option>`;
    for (const c of orden) {
      const cuentas = S.plan.filter(a => a.activa !== false && String(a.codigo)[0] === String(c));
      if (!cuentas.length) continue;
      html += `<optgroup label="${c} · ${CLASES[c]}">` +
        cuentas.map(a => `<option value="${esc(a.codigo)}"${a.codigo === valor ? " selected" : ""}>${esc(a.codigo)} — ${esc(a.nombre)}</option>`).join("") +
        `</optgroup>`;
    }
    return html;
  }

  function poblarSelectContable(auto) {
    const sel = $("mov-cuenta-contable");
    if (!sel) return;
    const prev = auto ? (cuentaPorCategoria(($("mov-categoria") || {}).value) || "") : sel.value;
    sel.innerHTML = opcionesContra(tipoMovActual(), prev);
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev; else sel.value = "";
  }

  let _previewIntentos = 0;
  function actualizarPreview() {
    const el = $("mov-asiento-preview");
    if (!el) return;
    const estado = ($("mov-estado") || {}).value || "realizado";
    const bankId = ($("mov-cuenta-bancaria") || {}).value;
    const cat = ($("mov-categoria") || {}).value;
    const tipo = tipoMovActual();
    const set = (txt, cls) => { el.textContent = txt; el.style.color = cls || "var(--gray-lt)"; };

    if (!S.plan.length) return set("Plan de cuentas vacío: cárgalo en la pestaña “Plan de cuentas” para que los movimientos pasen al libro.", "#b45309");
    if (estado !== "realizado") return set(`Estado “${estado}”: no genera asiento hasta que se realice.`);
    if (!bankId) return set("Sin cuenta bancaria: este movimiento no pasará al libro.", "#b45309");
    const bank = S.bancos.find(b => b.id === bankId);
    if (!bank) {
      if (_previewIntentos++ < 2) loadBancos().then(actualizarPreview);
      return set("…");
    }
    _previewIntentos = 0;
    const contra = ($("mov-cuenta-contable") || {}).value || cuentaPorCategoria(cat);
    if (!contra) return set("Elige la cuenta contable: sin ella no pasará al libro.", "#b45309");
    const cb = codigoBanco(bank);
    const nb = S.planMap[cb] ? S.planMap[cb].nombre : "(no existe en el plan)";
    const nc = S.planMap[contra] ? S.planMap[contra].nombre : "(no existe en el plan)";
    const debe = tipo === "ingreso" ? `${cb} ${nb}` : `${contra} ${nc}`;
    const haber = tipo === "ingreso" ? `${contra} ${nc}` : `${cb} ${nb}`;
    set(`Asiento: Debe ${debe}  ·  Haber ${haber}`, "var(--green-dk)");
  }

  function initFormMovimiento() {
    const sel = $("mov-cuenta-contable");
    if (!sel) return;
    const cat = $("mov-categoria");
    if (cat) cat.addEventListener("change", () => { poblarSelectContable(true); actualizarPreview(); });
    document.querySelectorAll('input[name="tipo-mov"]').forEach(r => r.addEventListener("change", () => { poblarSelectContable(true); actualizarPreview(); }));
    sel.addEventListener("change", actualizarPreview);
    ["mov-estado", "mov-cuenta-bancaria"].forEach(i => { const e = $(i); if (e) e.addEventListener("change", actualizarPreview); });
  }

  function resetFormMov() { poblarSelectContable(true); actualizarPreview(); }

  // ── TAB: CUENTAS T ─────────────────────────────────────────
  function renderT() {
    const grid = $("lt-grid");
    if (!grid) return;
    const desde = inicioDia($("lt-desde").value), hasta = finDia($("lt-hasta").value);
    const m = mayor({ desde, hasta });
    const clase = $("lt-clase").value, q = $("lt-q").value.trim().toLowerCase(), solo = $("lt-solo").checked;

    const codigos = [...new Set([...S.plan.map(a => a.codigo), ...Object.keys(m)])].sort();
    let totD = 0, totH = 0, n = 0;
    const html = [];

    for (const cod of codigos) {
      const acc = S.planMap[cod] || { codigo: cod, nombre: "(cuenta no está en el plan)", naturaleza: natDefault(cod) };
      const r = m[cod] || { antDebe: 0, antHaber: 0, debe: 0, haber: 0, lineas: [] };
      totD += r.antDebe + r.debe; totH += r.antHaber + r.haber;
      const tiene = r.lineas.length || r.antDebe || r.antHaber;
      if (solo && !tiene) continue;
      if (clase && cod[0] !== clase) continue;
      if (q && !(cod.includes(q) || String(acc.nombre).toLowerCase().includes(q))) continue;
      n++;

      const ant = r.antDebe - r.antHaber;
      const net = (r.antDebe + r.debe) - (r.antHaber + r.haber);
      const nat = acc.naturaleza || natDefault(cod);
      const saldoNat = nat === "debito" ? net : -net;
      const lado = net >= 0 ? "deudor" : "acreedor";
      const raro = saldoNat < -0.5;
      const filas = (arr, key) => arr.filter(l => l[key] > 0).map(l =>
        `<div class="lb-row" title="${esc(fechaCorta(l.fecha))} · ${esc(l.desc)}"><span>${fechaCorta(l.fecha).slice(0, 5)} <small>${esc(String(l.desc || "").slice(0, 14))}</small></span><b>${fm(l[key])}</b></div>`).join("");
      const antD = ant > 0 ? `<div class="lb-row"><small>Saldo anterior</small><b>${fm(ant)}</b></div>` : "";
      const antH = ant < 0 ? `<div class="lb-row"><small>Saldo anterior</small><b>${fm(-ant)}</b></div>` : "";

      html.push(`
        <div class="lb-t">
          <div class="lb-t-head">
            <div style="min-width:0"><span class="lb-cod">${esc(cod)}</span><b style="font-size:.84rem">${esc(acc.nombre)}</b>
              <div class="lb-mini">${nat === "debito" ? "Naturaleza débito" : "Naturaleza crédito"}${acc.activa === false ? " · inactiva" : ""}</div></div>
            <button class="btn btn-gray btn-sm" title="Registrar asiento con esta cuenta" onclick="Libro.nuevoAsiento('${esc(cod)}')"><i class="fas fa-plus"></i></button>
          </div>
          <div class="lb-t-body">
            <div class="lb-col"><div class="lb-colh">Debe</div>${antD}${filas(r.lineas, "debe")}</div>
            <div class="lb-col"><div class="lb-colh">Haber</div>${antH}${filas(r.lineas, "haber")}</div>
          </div>
          <div class="lb-t-foot">
            <div class="flex justify-between"><span class="lb-mini">Sumas</span><span class="lb-mini">${fm(r.antDebe + r.debe)} | ${fm(r.antHaber + r.haber)}</span></div>
            <div class="flex justify-between mt-1"><span>Saldo ${lado}</span><span class="lb-saldo ${raro ? "lb-warn" : ""}">${fm(Math.abs(net))}</span></div>
            ${raro ? `<div class="lb-mini lb-warn">Saldo contrario a su naturaleza — revisa</div>` : ""}
          </div>
        </div>`);
    }

    grid.innerHTML = html.join("");
    $("lt-vacio").classList.toggle("hidden", n > 0);
    const ok = Math.abs(totD - totH) < 0.5;
    $("lt-totales").innerHTML = `<div class="card p-3 mb-4 flex flex-wrap justify-between gap-2 text-sm">
      <span>${n} cuentas · ${S.asientos.length} asientos</span>
      <span style="color:${ok ? "var(--green-dk)" : "#b91c1c"};font-weight:700">${ok ? "✓ Sumas iguales" : "✗ Sumas diferentes"} — Debe ${fm(totD)} · Haber ${fm(totH)}</span></div>`;
  }

  // ── ALERTAS: movimientos sin asiento ───────────────────────
  function renderAlertas() {
    const cont = $("lt-alertas");
    if (!cont) return;
    const sin = S.movs.filter(m => !m.asientoId);
    if (!sin.length) { cont.innerHTML = ""; return; }

    const reales = sin.filter(m => (m.estado || "realizado") === "realizado");
    const filas = sin.slice(0, 40).map(m => {
      const bank = S.bancos.find(b => b.id === m.cuentaId);
      const r = resolver(m.id, m, bank);
      const est = m.estado || "realizado";
      const f = toD(m.fecha);
      let accion = "";
      if (est === "realizado" && r.necesitaContra) {
        accion = `<select id="fix-${m.id}" class="inp" style="padding:4px 6px;font-size:.75rem;max-width:200px">${opcionesContra(m.tipo, "")}</select>
                  <button class="btn btn-orange btn-sm" onclick="Libro.asignarYRegistrar('${m.id}')">Registrar</button>`;
      } else if (est === "realizado" && !r.motivo) {
        accion = `<button class="btn btn-orange btn-sm" onclick="Libro.asignarYRegistrar('${m.id}')">Registrar</button>`;
      } else if (est !== "realizado" && m.cuentaId) {
        accion = `${r.necesitaContra || !m.cuentaContable ? `<select id="fix-${m.id}" class="inp" style="padding:4px 6px;font-size:.75rem;max-width:200px">${opcionesContra(m.tipo, "")}</select>` : ""}
                  <button class="btn btn-gray btn-sm" onclick="Libro.asignarYRegistrar('${m.id}', true)">Marcar realizado</button>`;
      } else if (!m.cuentaId) {
        accion = `<button class="btn btn-gray btn-sm" onclick="Libro.asientoDesdeMovimiento('${m.id}')">Anotar manual</button>`;
      }
      const motivo = m.asientoMotivo && r.motivo ? r.motivo : (r.motivo || "Listo para registrar");
      return `<tr>
        <td class="lb-mini">${fechaCorta(f)}</td>
        <td>${esc(m.descripcion || "—")}<div class="lb-mini">${esc(motivo)}</div></td>
        <td style="text-align:right;font-weight:700;color:${m.tipo === "ingreso" ? "#15803d" : "#dc2626"}">${m.tipo === "ingreso" ? "+" : "−"}${fm(m.monto)}</td>
        <td><span class="badge ${est === "realizado" ? "badge-green" : "badge-yellow"}">${esc(est)}</span></td>
        <td><div class="flex gap-1 items-center flex-wrap">${accion}</div></td></tr>`;
    }).join("");

    cont.innerHTML = `<details class="card p-4 mb-4" ${reales.length ? "open" : ""}>
      <summary class="font-bold cursor-pointer" style="color:${reales.length ? "#b45309" : "var(--gray)"}">
        ${reales.length ? `⚠️ ${reales.length} movimiento(s) realizados sin asiento` : "Movimientos sin asiento"} · ${sin.length} en total (pendientes/programados no pasan al libro hasta realizarse)
      </summary>
      <div class="overflow-x-auto mt-3"><table class="w-full"><thead><tr><th>Fecha</th><th>Movimiento</th><th style="text-align:right">Monto</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${filas}</tbody></table></div>
      ${sin.length > 40 ? `<p class="lb-mini mt-2">Mostrando 40 de ${sin.length}.</p>` : ""}
    </details>`;
  }

  async function asignarYRegistrar(id, marcarRealizado) {
    const mov = S.movs.find(x => x.id === id);
    if (!mov) return;
    const sel = $("fix-" + id);
    const contra = sel && sel.value ? sel.value : mov.cuentaContable;
    const datos = { ...mov, cuentaContable: contra || null };
    try {
      if (contra && contra !== mov.cuentaContable) await db.collection("movimientos").doc(id).update({ cuentaContable: contra });
      const r = await registrarMovimiento(id, datos, { marcarRealizado: !!marcarRealizado });
      if (!r.ok) alert("No se pudo registrar: " + r.motivo);
    } catch (e) { alert("Error: " + (e.message || e)); }
    await refrescar();
  }

  // ── ASIENTO MANUAL (modal) ─────────────────────────────────
  function opcionesTodas() {
    return `<option value="">— cuenta —</option>` + S.plan.filter(a => a.activa !== false)
      .map(a => `<option value="${esc(a.codigo)}">${esc(a.codigo)} — ${esc(a.nombre)}</option>`).join("");
  }

  function agregarLinea(codigo, debe, haber) {
    const cont = $("as-lineas");
    const div = document.createElement("div");
    div.className = "lb-linea";
    div.innerHTML = `<select class="inp as-cta">${opcionesTodas()}</select>
      <input type="number" min="0" step="any" class="inp as-debe" placeholder="Debe">
      <input type="number" min="0" step="any" class="inp as-haber" placeholder="Haber">
      <button type="button" class="text-red-400 hover:text-red-600" title="Quitar">✕</button>`;
    cont.appendChild(div);
    if (codigo) div.querySelector(".as-cta").value = codigo;
    if (debe) div.querySelector(".as-debe").value = debe;
    if (haber) div.querySelector(".as-haber").value = haber;
    div.querySelector("button").addEventListener("click", () => { div.remove(); totalesAsiento(); });
    div.querySelectorAll("input,select").forEach(e => e.addEventListener("input", totalesAsiento));
  }

  function leerLineas() {
    return [...document.querySelectorAll("#as-lineas .lb-linea")].map(r => ({
      codigo: r.querySelector(".as-cta").value,
      debe: Number(r.querySelector(".as-debe").value) || 0,
      haber: Number(r.querySelector(".as-haber").value) || 0
    }));
  }

  function totalesAsiento() {
    const ls = leerLineas();
    const d = ls.reduce((a, l) => a + l.debe, 0), h = ls.reduce((a, l) => a + l.haber, 0);
    const ok = d > 0 && Math.abs(d - h) < 0.005;
    $("as-totales").innerHTML = `Debe <b>${fm(d)}</b> · Haber <b>${fm(h)}</b> · <span style="color:${ok ? "var(--green-dk)" : "#b91c1c"};font-weight:700">${ok ? "✓ Cuadra" : `Diferencia ${fm(Math.abs(d - h))}`}</span>`;
    $("as-guardar").disabled = !ok;
    $("as-guardar").style.opacity = ok ? "1" : ".5";
  }

  function nuevoAsiento(codigo, pref = {}) {
    if (!S.plan.length) { alert("Primero carga el plan de cuentas (pestaña Plan de cuentas)."); return; }
    $("as-fecha").value = pref.fecha || hoyISO();
    $("as-desc").value = pref.desc || "";
    $("as-lineas").innerHTML = "";
    agregarLinea(codigo || "", pref.monto || "", "");
    agregarLinea("", "", pref.monto || "");
    totalesAsiento();
    $("modal-asiento").classList.remove("hidden");
  }

  function asientoDesdeMovimiento(id) {
    const m = S.movs.find(x => x.id === id);
    if (!m) return;
    const f = toD(m.fecha);
    nuevoAsiento("", { fecha: f ? f.toISOString().slice(0, 10) : null, desc: m.descripcion, monto: Number(m.monto || 0) });
  }

  async function guardarAsiento() {
    const desc = $("as-desc").value.trim();
    const fv = $("as-fecha").value;
    if (!desc) { alert("Escribe una descripción"); return; }
    if (!fv) { alert("Elige la fecha"); return; }
    const ls = leerLineas();
    if (ls.length < 2 || ls.some(l => !l.codigo)) { alert("Cada línea necesita una cuenta (mínimo 2 líneas)"); return; }
    if (ls.some(l => (l.debe > 0) === (l.haber > 0))) { alert("Cada línea debe tener Debe o Haber (uno solo)"); return; }
    const d = ls.reduce((a, l) => a + l.debe, 0), h = ls.reduce((a, l) => a + l.haber, 0);
    if (Math.abs(d - h) > 0.005) { alert("El asiento no cuadra"); return; }
    try {
      await db.collection("asientos").add({
        fecha: new Date(fv + "T12:00:00"), descripcion: desc, origen: { tipo: "manual", id: null },
        lineas: ls.map(l => ({ codigo: l.codigo, nombre: (S.planMap[l.codigo] || {}).nombre || "", debe: l.debe, haber: l.haber })),
        totalDebe: d, totalHaber: h, creadoEn: new Date(), creadoPor: usuario()
      });
      $("modal-asiento").classList.add("hidden");
      await refrescar();
    } catch (e) { alert("No se pudo guardar el asiento: " + (e.message || e)); }
  }

  // ── HISTÓRICO: apertura de bancos + movimientos sin asiento ─
  async function generarHistorico() {
    await loadAll();
    if (!S.plan.length) { alert("Primero carga el plan de cuentas (pestaña Plan de cuentas)."); return; }
    if (!confirm("Se generarán:\n• Un asiento de apertura por cada cuenta bancaria (saldo inicial contra 3105 Capital)\n• Los asientos de los movimientos realizados que aún no tienen\n\nNo duplica lo que ya existe. ¿Continuar?")) return;

    const problemas = [];
    let aperturas = 0, generados = 0;

    for (const b of S.bancos) {
      const id = "apertura_" + b.id;
      if (S.asientoIds.has(id)) continue;
      const movsB = S.movs.filter(m => m.cuentaId === b.id && (m.estado || "realizado") === "realizado");
      const neto = movsB.reduce((a, m) => a + (m.tipo === "ingreso" ? 1 : -1) * Number(m.monto || 0), 0);
      const s0 = Number(b.saldo || 0) - neto;
      if (Math.abs(s0) < 0.5) continue;
      const cb = codigoBanco(b);
      if (!S.planMap[cb] || !S.planMap["3105"]) { problemas.push(`Apertura de “${b.nombre}”: falta la cuenta ${!S.planMap[cb] ? cb : "3105"} en el plan`); continue; }
      const fechas = movsB.map(m => toD(m.fecha)).filter(Boolean).sort((a, z) => a - z);
      const f = fechas.length ? new Date(fechas[0].getTime() - 86400000) : (toD(b.creadoEn) || new Date());
      const monto = Math.abs(s0);
      const lb = { codigo: cb, nombre: S.planMap[cb].nombre, debe: s0 > 0 ? monto : 0, haber: s0 > 0 ? 0 : monto };
      const lc = { codigo: "3105", nombre: S.planMap["3105"].nombre, debe: s0 > 0 ? 0 : monto, haber: s0 > 0 ? monto : 0 };
      try {
        await db.collection("asientos").doc(id).set({
          fecha: f, descripcion: `Saldo inicial — ${b.nombre}`, origen: { tipo: "apertura", id: b.id },
          lineas: s0 > 0 ? [lb, lc] : [lc, lb], totalDebe: monto, totalHaber: monto, creadoEn: new Date(), creadoPor: usuario()
        });
        S.asientoIds.add(id); aperturas++;
      } catch (e) { problemas.push(`Apertura de “${b.nombre}”: ${e.message || e}`); }
    }

    const reales = S.movs.filter(m => !m.asientoId && (m.estado || "realizado") === "realizado");
    for (const m of reales) {
      try {
        const r = await registrarMovimiento(m.id, m);
        if (r.ok) generados++; else problemas.push(`“${m.descripcion || m.id}”: ${r.motivo}`);
      } catch (e) { problemas.push(`“${m.descripcion || m.id}”: ${e.message || e}`); }
    }

    await refrescar();
    alert(`✅ Aperturas: ${aperturas} · Movimientos registrados: ${generados}` +
      (problemas.length ? `\n\n⚠️ ${problemas.length} sin registrar (revisa el aviso en Cuentas T):\n• ` + problemas.slice(0, 8).join("\n• ") : ""));
  }

  // ── TAB: BALANCE ───────────────────────────────────────────
  function datosBalance(corte) {
    const m = mayor({ hasta: corte });
    const g = { 1: [], 2: [], 3: [] };
    let ing = 0, cos = 0, gas = 0;
    for (const cod of Object.keys(m).sort()) {
      const nombre = (S.planMap[cod] || { nombre: "(no está en el plan)" }).nombre;
      const net = m[cod].debe - m[cod].haber;
      const c = cod[0];
      if (c === "1") g[1].push({ cod, nombre, saldo: net });
      else if (c === "2" || c === "3") g[c].push({ cod, nombre, saldo: -net });
      else if (c === "4") ing += -net;
      else if (c === "5") gas += net;
      else if (c === "6" || c === "7") cos += net;
    }
    for (const k of [1, 2, 3]) g[k] = g[k].filter(x => Math.abs(x.saldo) > 0.5);
    const sum = arr => arr.reduce((a, x) => a + x.saldo, 0);
    const resultado = ing - cos - gas;
    const activo = sum(g[1]), pasivo = sum(g[2]), patrimonio = sum(g[3]) + resultado;
    return { g, ing, cos, gas, resultado, activo, pasivo, patrimonio, diff: activo - (pasivo + patrimonio) };
  }

  function renderBalance() {
    const cont = $("bl-contenido");
    if (!cont) return;
    const corte = finDia($("bl-corte").value || hoyISO());
    const b = datosBalance(corte);
    const lineas = arr => arr.map(x => `<div class="lb-bal-row"><span><span class="lb-cod">${esc(x.cod)}</span>${esc(x.nombre)}</span><b>${fm(x.saldo)}</b></div>`).join("") || `<p class="lb-mini py-2">Sin saldos</p>`;
    const ok = Math.abs(b.diff) < 0.5;
    cont.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div class="card p-5">
          <h3 class="font-bold mb-2" style="color:var(--green-dk)">ACTIVO</h3>
          ${lineas(b.g[1])}
          <div class="lb-bal-tot"><span>Total activo</span><span>${fm(b.activo)}</span></div>
        </div>
        <div class="card p-5">
          <h3 class="font-bold mb-2" style="color:var(--green-dk)">PASIVO</h3>
          ${lineas(b.g[2])}
          <div class="lb-bal-tot"><span>Total pasivo</span><span>${fm(b.pasivo)}</span></div>
          <h3 class="font-bold mt-5 mb-2" style="color:var(--green-dk)">PATRIMONIO</h3>
          ${lineas(b.g[3])}
          <div class="lb-bal-row"><span><i>Resultado acumulado (ingresos − costos − gastos)</i></span><b>${fm(b.resultado)}</b></div>
          <div class="lb-bal-tot"><span>Total patrimonio</span><span>${fm(b.patrimonio)}</span></div>
          <div class="lb-bal-tot"><span>Pasivo + Patrimonio</span><span>${fm(b.pasivo + b.patrimonio)}</span></div>
        </div>
      </div>
      <div class="card p-4 mt-4 text-sm" style="border-color:${ok ? "var(--green)" : "#ef4444"}">
        <b style="color:${ok ? "var(--green-dk)" : "#b91c1c"}">${ok ? "✓ El balance cuadra (Activo = Pasivo + Patrimonio)" : `✗ No cuadra: diferencia de ${fm(Math.abs(b.diff))}`}</b>
        <span class="lb-mini block mt-1">Resultado: ingresos ${fm(b.ing)} · costos ${fm(b.cos)} · gastos ${fm(b.gas)} → ${b.resultado >= 0 ? "utilidad" : "pérdida"} ${fm(Math.abs(b.resultado))}. Corte a ${fechaCorta(corte)}.</span>
      </div>`;
  }

  // ── TAB: PLAN DE CUENTAS ───────────────────────────────────
  function renderPlan() {
    const tb = $("pc-tbody");
    if (!tb) return;
    const nCat = S.plan.length;
    $("pc-setup").innerHTML = `<div class="text-sm space-y-1">
      <div>${nCat ? "✅" : "⬜"} <b>1.</b> Plan de cuentas ${nCat ? `cargado (${nCat} cuentas)` : "vacío — pulsa “Cargar PUC base”"}</div>
      <div>${S.bancos.length ? "✅" : "⬜"} <b>2.</b> Vincular cada cuenta bancaria a su cuenta contable (abajo; si no eliges, se usa 1105 Caja / 1110 Bancos / 1120 Ahorros según el tipo)</div>
      <div>${S.movs.some(m => !m.asientoId && (m.estado || "realizado") === "realizado") ? "⬜" : "✅"} <b>3.</b> Generar histórico en la pestaña Cuentas T (saldos iniciales + movimientos ya existentes)</div></div>`;

    tb.innerHTML = S.plan.map(a => `<tr style="${a.activa === false ? "opacity:.5" : ""}">
      <td class="lb-cod">${esc(a.codigo)}</td><td>${esc(a.nombre)}</td>
      <td><span class="badge ${a.naturaleza === "debito" ? "badge-blue" : "badge-orange"}">${a.naturaleza === "debito" ? "Débito" : "Crédito"}</span></td>
      <td class="lb-mini">${esc((a.categorias || []).join(", "))}</td>
      <td style="white-space:nowrap"><button class="btn btn-gray btn-sm" onclick="Libro.editarCuenta('${esc(a.codigo)}')">Editar</button>
        <button class="btn btn-gray btn-sm" onclick="Libro.toggleCuenta('${esc(a.codigo)}')">${a.activa === false ? "Activar" : "Inactivar"}</button></td></tr>`).join("");
    $("pc-vacio").classList.toggle("hidden", nCat > 0);

    const opts = (sel) => S.plan.filter(a => a.activa !== false && (a.codigo[0] === "1" || a.codigo[0] === "2"))
      .map(a => `<option value="${esc(a.codigo)}"${a.codigo === sel ? " selected" : ""}>${esc(a.codigo)} — ${esc(a.nombre)}</option>`).join("");
    $("pc-bancos").innerHTML = S.bancos.length ? S.bancos.map(b => `<div class="flex flex-wrap items-center gap-2 mb-2">
        <span class="text-sm font-semibold" style="min-width:150px">${esc(b.nombre)} <span class="lb-mini">(${esc(b.tipo || "cuenta")})</span></span>
        <select class="inp" style="max-width:340px" onchange="Libro.vincularBanco('${b.id}', this.value)">${opts(codigoBanco(b))}</select></div>`).join("")
      : `<p class="lb-mini">Aún no tienes cuentas bancarias (pestaña Mis Cuentas).</p>`;
  }

  function limpiarFormCuenta() {
    ["pc-codigo", "pc-nombre", "pc-categorias"].forEach(i => { $(i).value = ""; });
    $("pc-codigo").readOnly = false;
    $("pc-naturaleza").value = "auto";
    $("pc-titulo").textContent = "Agregar cuenta";
    $("pc-cancelar").classList.add("hidden");
  }

  function editarCuenta(cod) {
    const a = S.planMap[cod];
    if (!a) return;
    $("pc-codigo").value = a.codigo; $("pc-codigo").readOnly = true;
    $("pc-nombre").value = a.nombre;
    $("pc-naturaleza").value = a.naturaleza || "auto";
    $("pc-categorias").value = (a.categorias || []).join(", ");
    $("pc-titulo").textContent = "Editar cuenta " + a.codigo;
    $("pc-cancelar").classList.remove("hidden");
    $("pc-nombre").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function guardarCuenta() {
    const codigo = $("pc-codigo").value.trim();
    const nombre = $("pc-nombre").value.trim();
    if (!/^\d{4,10}$/.test(codigo) || !/^[1-7]/.test(codigo)) { alert("El código debe ser numérico (4 a 10 dígitos) y empezar por 1–7"); return; }
    if (!nombre) { alert("Escribe el nombre de la cuenta"); return; }
    const natSel = $("pc-naturaleza").value;
    const cats = $("pc-categorias").value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    const data = { codigo, nombre, clase: Number(codigo[0]), naturaleza: natSel === "auto" ? natDefault(codigo) : natSel, categorias: cats, actualizadoEn: new Date() };
    const existe = S.planMap[codigo];
    if (!existe) { data.activa = true; data.origen = "manual"; data.creadoEn = new Date(); }
    try {
      await db.collection("planCuentas").doc(codigo).set(data, { merge: true });
      limpiarFormCuenta();
      await refrescar();
    } catch (e) { alert("No se pudo guardar: " + (e.message || e)); }
  }

  async function toggleCuenta(cod) {
    const a = S.planMap[cod];
    if (!a) return;
    await db.collection("planCuentas").doc(cod).update({ activa: a.activa === false });
    await refrescar();
  }

  async function vincularBanco(id, cod) {
    try {
      await db.collection("cuentasBancarias").doc(id).update({ cuentaContable: cod });
      const b = S.bancos.find(x => x.id === id);
      if (b) b.cuentaContable = cod;
      actualizarPreview();
    } catch (e) { alert("No se pudo vincular: " + (e.message || e)); }
  }

  async function escribirCuentas(lista) {
    let n = 0;
    for (let i = 0; i < lista.length; i += 400) {
      const batch = db.batch();
      lista.slice(i, i + 400).forEach(c => { batch.set(db.collection("planCuentas").doc(c.codigo), c); n++; });
      await batch.commit();
    }
    return n;
  }

  async function cargarPUCBase() {
    await loadPlan();
    const inv = {};
    Object.entries(CAT_DEFAULT).forEach(([cat, cod]) => { (inv[cod] ||= []).push(cat); });
    const nuevas = PUC_BASE.filter(([c]) => !S.planMap[c]).map(([codigo, nombre, nat]) => ({
      codigo, nombre, clase: Number(codigo[0]), naturaleza: nat || natDefault(codigo),
      categorias: inv[codigo] || [], activa: true, origen: "base", creadoEn: new Date()
    }));
    if (!nuevas.length) { alert("El PUC base ya está cargado."); return; }
    if (!confirm(`Se agregarán ${nuevas.length} cuentas base (no toca las que ya tienes). Es un catálogo simplificado: valídalo con tu contador. ¿Continuar?`)) return;
    try { await escribirCuentas(nuevas); await refrescar(); alert(`✅ ${nuevas.length} cuentas cargadas`); }
    catch (e) { alert("Error al cargar: " + (e.message || e)); }
  }

  async function importarCSV(file) {
    if (!file) return;
    const texto = await file.text();
    const filas = texto.split(/\r?\n/).map(l => l.split(/[;,\t]/).map(c => c.replace(/^"|"$/g, "").trim())).filter(r => r.length >= 2);
    await loadPlan();
    const vistos = new Set();
    const nuevas = [];
    for (const [codigo, nombre, nat] of filas) {
      if (!/^\d{4,10}$/.test(codigo) || !/^[1-7]/.test(codigo) || !nombre) continue;
      if (S.planMap[codigo] || vistos.has(codigo)) continue;
      vistos.add(codigo);
      const n = /^cr/i.test(nat || "") ? "credito" : /^d/i.test(nat || "") ? "debito" : natDefault(codigo);
      nuevas.push({ codigo, nombre, clase: Number(codigo[0]), naturaleza: n, categorias: [], activa: true, origen: "csv", creadoEn: new Date() });
    }
    if (!nuevas.length) { alert("No se encontraron cuentas nuevas. Formato: codigo;nombre[;debito|credito]"); return; }
    if (!confirm(`Se importarán ${nuevas.length} cuentas nuevas. ¿Continuar?`)) return;
    try { await escribirCuentas(nuevas); await refrescar(); alert(`✅ ${nuevas.length} cuentas importadas`); }
    catch (e) { alert("Error al importar: " + (e.message || e)); }
  }

  // ── EXPORTAR ───────────────────────────────────────────────
  function filasDiario() {
    const out = [];
    for (const a of S.asientos) {
      const f = toD(a.fecha);
      for (const l of a.lineas || []) {
        out.push({ Fecha: fechaCorta(f), Asiento: a.id, Descripción: a.descripcion || "", Origen: (a.origen && a.origen.tipo) || "", Código: l.codigo, Cuenta: l.nombre || (S.planMap[l.codigo] || {}).nombre || "", Debe: Number(l.debe || 0), Haber: Number(l.haber || 0) });
      }
    }
    return out;
  }

  function filasMayor() {
    const m = mayor({});
    const out = [];
    for (const cod of Object.keys(m).sort()) {
      const acc = S.planMap[cod] || { nombre: "(no está en el plan)", naturaleza: natDefault(cod) };
      let acum = 0;
      for (const l of m[cod].lineas) {
        acum += acc.naturaleza === "debito" ? l.debe - l.haber : l.haber - l.debe;
        out.push({ Código: cod, Cuenta: acc.nombre, Naturaleza: acc.naturaleza, Fecha: fechaCorta(l.fecha), Descripción: l.desc || "", Debe: l.debe, Haber: l.haber, "Saldo acumulado": acum });
      }
    }
    return out;
  }

  function filasBalance(b) {
    const f = [];
    const add = (sec, arr) => arr.forEach(x => f.push({ Sección: sec, Código: x.cod, Cuenta: x.nombre, Saldo: x.saldo }));
    add("Activo", b.g[1]); f.push({ Sección: "Activo", Código: "", Cuenta: "TOTAL ACTIVO", Saldo: b.activo });
    add("Pasivo", b.g[2]); f.push({ Sección: "Pasivo", Código: "", Cuenta: "TOTAL PASIVO", Saldo: b.pasivo });
    add("Patrimonio", b.g[3]);
    f.push({ Sección: "Patrimonio", Código: "", Cuenta: "Resultado acumulado", Saldo: b.resultado });
    f.push({ Sección: "Patrimonio", Código: "", Cuenta: "TOTAL PATRIMONIO", Saldo: b.patrimonio });
    f.push({ Sección: "Control", Código: "", Cuenta: "Pasivo + Patrimonio", Saldo: b.pasivo + b.patrimonio });
    return f;
  }

  function filasPlan() {
    return S.plan.map(a => ({ Código: a.codigo, Cuenta: a.nombre, Clase: CLASES[a.clase] || "", Naturaleza: a.naturaleza, "Categorías por defecto": (a.categorias || []).join(", "), Activa: a.activa === false ? "No" : "Sí" }));
  }

  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function exportarCSV(tipo) {
    const corte = finDia(($("bl-corte") || {}).value || hoyISO());
    const filas = tipo === "balance" ? filasBalance(datosBalance(corte)) : tipo === "plan" ? filasPlan() : filasDiario();
    if (!filas.length) { alert("No hay datos para exportar."); return; }
    const cols = Object.keys(filas[0]);
    const csv = [cols, ...filas.map(r => cols.map(c => r[c]))]
      .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    descargar(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), `DOMKA_${tipo}_${hoyISO()}.csv`);
  }

  function exportarExcel() {
    if (!window.XLSX) { alert("No se pudo cargar la librería de Excel. Revisa tu conexión."); return; }
    const corte = finDia(($("bl-corte") || {}).value || hoyISO());
    const wb = XLSX.utils.book_new();
    const hoja = (nombre, filas) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas.length ? filas : [{ Info: "Sin datos" }]), nombre);
    hoja("Plan de cuentas", filasPlan());
    hoja("Libro diario", filasDiario());
    hoja("Cuentas T (mayor)", filasMayor());
    hoja("Balance", filasBalance(datosBalance(corte)));
    XLSX.writeFile(wb, `DOMKA_libro_contable_${hoyISO()}.xlsx`);
  }

  function cargarScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }

  async function exportarPDF() {
    try {
      if (!window.pdfMake) {
        await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js");
        await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js");
      }
    } catch (e) { alert(e.message); return; }
    const corte = finDia(($("bl-corte") || {}).value || hoyISO());
    const b = datosBalance(corte);
    const tabla = (titulo, arr, total, extra = []) => [
      { text: titulo, style: "h2" },
      { table: { widths: [50, "*", 90], body: [
        ...arr.map(x => [x.cod, x.nombre, { text: fm(x.saldo), alignment: "right" }]),
        ...extra.map(x => ["", x[0], { text: fm(x[1]), alignment: "right" }]),
        [{ text: "", border: [false, true, false, false] }, { text: "Total " + titulo.toLowerCase(), bold: true, border: [false, true, false, false] }, { text: fm(total), bold: true, alignment: "right", border: [false, true, false, false] }]
      ] }, layout: "lightHorizontalLines", margin: [0, 0, 0, 12] }
    ];
    pdfMake.createPdf({
      pageSize: "LETTER", pageMargins: [40, 50, 40, 50],
      content: [
        { text: "DOMKA CONSTRUCCIONES", style: "h1" },
        { text: `Balance general — corte a ${fechaCorta(corte)}`, margin: [0, 0, 0, 14], color: "#5a5a5a" },
        ...tabla("Activo", b.g[1], b.activo),
        ...tabla("Pasivo", b.g[2], b.pasivo),
        ...tabla("Patrimonio", b.g[3], b.patrimonio, [["Resultado acumulado", b.resultado]]),
        { text: `Pasivo + Patrimonio: ${fm(b.pasivo + b.patrimonio)} — ${Math.abs(b.diff) < 0.5 ? "el balance cuadra" : "diferencia " + fm(Math.abs(b.diff))}`, bold: true }
      ],
      styles: { h1: { fontSize: 16, bold: true, color: "#155c3c" }, h2: { fontSize: 12, bold: true, margin: [0, 6, 0, 4], color: "#1b7a51" } },
      defaultStyle: { fontSize: 9 }
    }).download(`DOMKA_balance_${hoyISO()}.pdf`);
  }

  // ── REFRESCO / INIT ────────────────────────────────────────
  async function refrescar() {
    try { await loadAll(); } catch (e) { console.warn("Libro:", e); }
    renderAlertas(); renderT(); renderBalance(); renderPlan();
    poblarSelectContable(false); actualizarPreview();
  }

  function on(id, ev, fn) { const e = $(id); if (e) e.addEventListener(ev, fn); }

  function init() {
    document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => {
      if (["cuentas-t", "balance", "plan"].includes(b.dataset.tab)) refrescar();
    }));
    if ($("bl-corte")) $("bl-corte").value = hoyISO();

    ["lt-desde", "lt-hasta", "lt-clase", "lt-solo"].forEach(i => on(i, "change", renderT));
    on("lt-q", "input", renderT);
    on("lt-nuevo", "click", () => nuevoAsiento());
    on("lt-historico", "click", generarHistorico);
    on("lt-xlsx", "click", exportarExcel);
    on("lt-csv", "click", () => exportarCSV("diario"));

    on("bl-corte", "change", renderBalance);
    on("bl-xlsx", "click", exportarExcel);
    on("bl-csv", "click", () => exportarCSV("balance"));
    on("bl-pdf", "click", exportarPDF);

    on("pc-guardar", "click", guardarCuenta);
    on("pc-cancelar", "click", limpiarFormCuenta);
    on("pc-puc", "click", cargarPUCBase);
    on("pc-csv-file", "change", e => { importarCSV(e.target.files[0]); e.target.value = ""; });
    on("pc-export", "click", () => exportarCSV("plan"));

    on("as-add", "click", () => { agregarLinea(); totalesAsiento(); });
    on("as-guardar", "click", guardarAsiento);
    on("as-cancelar", "click", () => $("modal-asiento").classList.add("hidden"));

    initFormMovimiento();
    if (window.auth) {
      auth.onAuthStateChanged(u => {
        if (!u) return;
        Promise.all([loadPlan(), loadBancos()]).then(() => { poblarSelectContable(true); actualizarPreview(); }).catch(() => {});
      });
    }
  }

  if (typeof document !== "undefined") init();

  window.Libro = {
    registrarMovimiento, revertirMovimiento, resetFormMov,
    nuevoAsiento, asientoDesdeMovimiento, asignarYRegistrar,
    editarCuenta, toggleCuenta, vincularBanco, refrescar,
    _test: { S, mayor, resolver, datosBalance, natDefault, PUC_BASE, CAT_DEFAULT }
  };
})();
