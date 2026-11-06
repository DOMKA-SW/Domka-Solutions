// js/contabilidad-libro.js — LIBRO CONTABLE DOMKA (Cuentas T · Balance · Plan de cuentas)
// ============================================================================
// Un solo archivo con 3 partes independientes (cada una es un bloque aparte):
//   PARTE 1 · Datos y reglas contables (no toca la pantalla): PUC base, Firestore, mayor, balance,
//             paso movimiento → asiento, configuración e histórico.
//   PARTE 2 · Exportar: Excel (4 hojas), CSV (diario, balance, plan) y PDF del balance.
//   PARTE 3 · Pantalla: pestaña "Libro contable" y el "Se registra en…" del formulario de movimientos.
//
// Se carga en contabilidad.html DESPUÉS de js/contabilidad.js.
//
// REGLAS DEL LIBRO
//   · Un movimiento pasa al libro solo si está "realizado", tiene cuenta bancaria y cuenta contable.
//     Si no, no pasa y la pantalla avisa por qué.
//   · Ingreso: Debe Banco / Haber cuenta elegida.  Gasto: Debe cuenta elegida / Haber Banco.
//   · El asiento de un movimiento tiene id "mov_<id del movimiento>" (no se duplica).
//     Al eliminar el movimiento, su asiento también se elimina (sin reversiones).
//   · Los asientos no se editan: se eliminan y se vuelven a crear.
//   · Saldo inicial de cada banco = saldo actual − movimientos realizados, contra 3105 Capital.
//
// ENGANCHES EN js/contabilidad.js (solo 3)
//   1. Al guardar un movimiento: guarda cuentaContable y llama Libro.registrarMovimiento(id, datos).
//   2. Al limpiar el formulario: Libro.resetFormMov().
//   3. Al eliminar un movimiento: Libro.quitarMovimiento(mov).
//
// FIRESTORE (colecciones nuevas; reglas en rules/firebase_rules.txt, se publican a mano en la consola)
//   planCuentas/{codigo}  asientos/{id}  ·  campos nuevos: movimientos.cuentaContable/asientoId/asientoEstado/
//   asientoMotivo y cuentasBancarias.cuentaContable
// ============================================================================


// ════════════════════════════════════════════════════════════════════════════
// PARTE 1 · DATOS Y REGLAS CONTABLES (sin pantalla)
// ════════════════════════════════════════════════════════════════════════════
(() => {
  "use strict";
  const Libro = (window.Libro = window.Libro || {});

  // ── 1. UTILIDADES ──────────────────────────────────────────────────────────
  const u = {
    esc: s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    fm: n => `$${Math.round(Number(n || 0)).toLocaleString("es-CO")}`,
    toD: v => (!v ? null : (v.toDate ? v.toDate() : new Date(v))),
    fechaCorta: d => (d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"),
    hoyISO: () => new Date().toISOString().slice(0, 10),
    inicioDia: v => (v ? new Date(v + "T00:00:00") : null),
    finDia: v => (v ? new Date(v + "T23:59:59") : null),
    usuario: () => (window.auth && auth.currentUser && auth.currentUser.email) || null,
    natDefault: cod => (["1", "5", "6", "7"].includes(String(cod)[0]) ? "debito" : "credito")
  };

  // ── 2. CATÁLOGOS ───────────────────────────────────────────────────────────
  const CLASES = {
    1: "Activo", 2: "Pasivo", 3: "Patrimonio", 4: "Ingresos",
    5: "Gastos", 6: "Costos de ventas", 7: "Costos de obra"
  };

  // PUC base simplificado (inspirado en el PUC colombiano, Decreto 2650/1993). Validar con el contador.
  // [codigo, nombre, naturaleza opcional si es contraria a la de su clase]
  const PUC_BASE = [
    ["1105", "Caja"], ["1110", "Bancos"], ["1120", "Cuentas de ahorro"],
    ["1305", "Clientes"], ["1330", "Anticipos y avances"],
    ["1355", "Anticipo de impuestos y saldos a favor"], ["1380", "Deudores varios"],
    ["1410", "Obras en curso (productos en proceso)"], ["1435", "Mercancías no fabricadas por la empresa"],
    ["1504", "Terrenos"], ["1516", "Construcciones y edificaciones"], ["1520", "Maquinaria y equipo"],
    ["1524", "Equipo de oficina"], ["1528", "Equipo de computación y comunicación"],
    ["1540", "Flota y equipo de transporte"], ["1592", "Depreciación acumulada", "credito"],
    ["2105", "Obligaciones financieras (bancos)"], ["2205", "Proveedores nacionales"],
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
    ["7105", "Materiales de obra"], ["7205", "Mano de obra directa"],
    ["7305", "Costos indirectos de obra"], ["7405", "Subcontratos de obra"]
  ];

  // categoría del formulario de movimientos → cuenta contable por defecto
  const CAT_DEFAULT = {
    "servicios-prestados": "4130", "freelance": "4130", "ventas": "4135",
    "arriendo-recibido": "4220", "rendimiento": "4210",
    "vivienda": "5120", "servicios-publicos": "5135", "transporte": "5155", "tecnologia": "5135",
    "materiales": "7105", "nomina": "5105", "publicidad": "5235", "impuestos": "5115", "deudas": "2105",
    "alimentacion": "5195", "salud": "5195", "educacion": "5195", "entretenimiento": "5195", "ropa": "5195"
  };

  // cuenta contable por defecto según el tipo de cuenta bancaria
  const BANCO_DEFAULT = { efectivo: "1105", ahorros: "1120", corriente: "1110", digital: "1110", inversion: "1110", credito: "2105", otro: "1110" };

  // ── 3. ESTADO COMPARTIDO ───────────────────────────────────────────────────
  const S = {
    plan: [], planMap: {}, planLoaded: false,
    asientos: [], asientoIds: new Set(),
    movs: [], movsOk: false,
    bancos: [], bancosLoaded: false
  };

  Object.assign(Libro, { u, S, CLASES, PUC_BASE, CAT_DEFAULT, BANCO_DEFAULT });

  const codigoBanco = b => (b && b.cuentaContable) || BANCO_DEFAULT[b && b.tipo] || "1110";

  function cuentaPorCategoria(cat) {
    if (!cat) return null;
    const a = S.plan.find(x => x.activa !== false && (x.categorias || []).includes(cat));
    return a ? a.codigo : null;
  }

  // ── 4. CARGA DE DATOS ──────────────────────────────────────────────────────
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

  async function obtenerBanco(id) {
    if (!id) return null;
    const b = S.bancos.find(x => x.id === id);
    if (b) return b;
    const d = await db.collection("cuentasBancarias").doc(id).get();
    return d.exists ? { id: d.id, ...d.data() } : null;
  }

  async function cargarTodo() {
    let movsOk = true;
    const [, asSnap, movSnap] = await Promise.all([
      loadPlan(),
      db.collection("asientos").orderBy("fecha", "asc").get().catch(() => ({ docs: [] })),
      db.collection("movimientos").orderBy("fecha", "desc").get().catch(() => { movsOk = false; return { docs: [] }; }),
      loadBancos()
    ]);
    S.movsOk = movsOk;
    S.asientos = asSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    S.asientoIds = new Set(S.asientos.map(a => a.id));
    S.movs = movSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ── 5. CÁLCULOS ────────────────────────────────────────────────────────────
  // Mayor: por cuenta, sumas de debe/haber y sus líneas. Con `desde`, lo anterior se resume en ant*.
  function mayor({ desde = null, hasta = null } = {}) {
    const m = {};
    const get = c => (m[c] ||= { codigo: c, antDebe: 0, antHaber: 0, debe: 0, haber: 0, lineas: [] });
    for (const a of S.asientos) {
      const f = u.toD(a.fecha);
      if (hasta && f > hasta) continue;
      for (const l of a.lineas || []) {
        const r = get(l.codigo);
        const d = Number(l.debe || 0), h = Number(l.haber || 0);
        if (desde && f < desde) { r.antDebe += d; r.antHaber += h; continue; }
        r.debe += d; r.haber += h;
        r.lineas.push({ fecha: f, desc: a.descripcion, debe: d, haber: h, asientoId: a.id, origen: (a.origen && a.origen.tipo) || "" });
      }
    }
    return m;
  }

  // Saldo de una cuenta según su naturaleza (positivo = normal; negativo = contrario)
  function saldoCuenta(acc, r) {
    const net = (r.antDebe + r.debe) - (r.antHaber + r.haber);
    return (acc.naturaleza || u.natDefault(acc.codigo)) === "debito" ? net : -net;
  }

  // Balance general + resultado a una fecha de corte
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

  // ── 6. MOVIMIENTOS ⇄ ASIENTOS ──────────────────────────────────────────────
  // Decide si un movimiento puede pasar al libro. Devuelve { asiento, contra } o { motivo }.
  function resolver(id, mov, bank) {
    const estado = mov.estado || "realizado";
    if (estado !== "realizado") return { motivo: `Estado “${estado}”: entra al libro cuando se realice` };
    if (mov.tipo !== "ingreso" && mov.tipo !== "gasto") return { motivo: "Tipo de movimiento no reconocido" };
    const monto = Number(mov.monto || 0);
    if (!(monto > 0)) return { motivo: "Monto inválido" };
    if (!S.plan.length) return { motivo: "El libro aún no está configurado" };
    if (!mov.cuentaId) return { motivo: "Sin cuenta bancaria asignada" };
    if (!bank) return { motivo: "La cuenta bancaria ya no existe" };
    const codBanco = codigoBanco(bank);
    if (!S.planMap[codBanco]) return { motivo: `La cuenta ${codBanco} (de “${bank.nombre}”) no existe en el plan` };
    const contra = mov.cuentaContable || cuentaPorCategoria(mov.categoria);
    if (!contra) return { motivo: "Falta elegir a qué cuenta va", necesitaContra: true };
    if (!S.planMap[contra]) return { motivo: `La cuenta ${contra} no existe en el plan`, necesitaContra: true };
    if (contra === codBanco) return { motivo: "La cuenta no puede ser la misma del banco", necesitaContra: true };

    const esIng = mov.tipo === "ingreso";
    const lB = { codigo: codBanco, nombre: S.planMap[codBanco].nombre, debe: esIng ? monto : 0, haber: esIng ? 0 : monto };
    const lC = { codigo: contra, nombre: S.planMap[contra].nombre, debe: esIng ? 0 : monto, haber: esIng ? monto : 0 };
    return {
      contra,
      asiento: {
        fecha: u.toD(mov.fecha) || new Date(),
        descripcion: mov.descripcion || "Movimiento",
        origen: { tipo: "movimiento", id },
        lineas: esIng ? [lB, lC] : [lC, lB],
        totalDebe: monto, totalHaber: monto,
        creadoEn: new Date(), creadoPor: u.usuario()
      }
    };
  }

  // Llamar al guardar un movimiento. opts.marcarRealizado: lo pasa a "realizado", ajusta el saldo y registra.
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

  // Llamar al borrar un movimiento: elimina su asiento (y reversiones antiguas). Nunca lanza error.
  async function quitarMovimiento(mov) {
    if (!mov || !mov.id) return { ok: true };
    try {
      const ids = ["mov_" + mov.id, "rev_" + mov.id];
      if (mov.asientoId && !ids.includes(mov.asientoId)) ids.push(mov.asientoId);
      const existentes = [];
      for (const id of ids) {
        const d = await db.collection("asientos").doc(id).get();
        if (d.exists) existentes.push(id);
      }
      if (existentes.length) await eliminarAsientos(existentes);
      return { ok: true };
    } catch (e) {
      console.warn("Libro: no se pudo quitar el asiento", e);
      return { ok: false, error: e };
    }
  }

  async function eliminarAsientos(ids) {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = db.batch();
      ids.slice(i, i + 400).forEach(id => batch.delete(db.collection("asientos").doc(id)));
      await batch.commit();
    }
    const fuera = new Set(ids);
    fuera.forEach(id => S.asientoIds.delete(id));
    S.asientos = S.asientos.filter(a => !fuera.has(a.id));
  }

  // Movimientos que no están en el libro, con el motivo y lo que falta para registrarlos
  function sinAsiento() {
    return S.movs.filter(m => !m.asientoId).map(m => {
      const bank = S.bancos.find(b => b.id === m.cuentaId);
      const r = resolver(m.id, m, bank);
      return { mov: m, estado: m.estado || "realizado", motivo: r.motivo || "Listo para registrar", necesitaContra: !!r.necesitaContra, sinBanco: !m.cuentaId, listo: !r.motivo };
    });
  }

  // Asientos que sobran: de movimientos ya eliminados, o reversiones de versiones anteriores
  function huerfanos() {
    if (!S.movsOk) return [];
    const ids = new Set(S.movs.map(m => m.id));
    return S.asientos.filter(a => {
      const t = a.origen && a.origen.tipo;
      return t === "reversion" || (t === "movimiento" && !ids.has(a.origen.id));
    });
  }

  // ── 7. CONFIGURACIÓN, HISTÓRICO Y ASIENTOS MANUALES ────────────────────────
  async function escribirCuentas(lista) {
    for (let i = 0; i < lista.length; i += 400) {
      const batch = db.batch();
      lista.slice(i, i + 400).forEach(c => batch.set(db.collection("planCuentas").doc(c.codigo), c));
      await batch.commit();
    }
    return lista.length;
  }

  // Carga el PUC base (solo las cuentas que faltan). Devuelve cuántas agregó.
  async function cargarPUC() {
    await loadPlan();
    const inv = {};
    Object.entries(CAT_DEFAULT).forEach(([cat, cod]) => { (inv[cod] ||= []).push(cat); });
    const nuevas = PUC_BASE.filter(([c]) => !S.planMap[c]).map(([codigo, nombre, nat]) => ({
      codigo, nombre, clase: Number(codigo[0]), naturaleza: nat || u.natDefault(codigo),
      categorias: inv[codigo] || [], activa: true, origen: "base", creadoEn: new Date()
    }));
    if (nuevas.length) await escribirCuentas(nuevas);
    await loadPlan();
    return nuevas.length;
  }

  // Importa cuentas desde texto CSV (codigo;nombre[;debito|credito]). Devuelve cuántas agregó.
  async function importarPlanTexto(texto) {
    const filas = texto.split(/\r?\n/).map(l => l.split(/[;,\t]/).map(c => c.replace(/^"|"$/g, "").trim())).filter(r => r.length >= 2);
    await loadPlan();
    const vistos = new Set(), nuevas = [];
    for (const [codigo, nombre, nat] of filas) {
      if (!/^\d{4,10}$/.test(codigo) || !/^[1-7]/.test(codigo) || !nombre) continue;
      if (S.planMap[codigo] || vistos.has(codigo)) continue;
      vistos.add(codigo);
      const n = /^cr/i.test(nat || "") ? "credito" : /^d/i.test(nat || "") ? "debito" : u.natDefault(codigo);
      nuevas.push({ codigo, nombre, clase: Number(codigo[0]), naturaleza: n, categorias: [], activa: true, origen: "csv", creadoEn: new Date() });
    }
    if (nuevas.length) await escribirCuentas(nuevas);
    await loadPlan();
    return nuevas.length;
  }

  // Crea o edita una cuenta del plan. Lanza Error con mensaje legible si los datos no son válidos.
  async function guardarCuenta({ codigo, nombre, naturaleza, categorias }) {
    codigo = String(codigo || "").trim(); nombre = String(nombre || "").trim();
    if (!/^\d{4,10}$/.test(codigo) || !/^[1-7]/.test(codigo)) throw new Error("El código debe ser numérico (4 a 10 dígitos) y empezar por 1–7");
    if (!nombre) throw new Error("Escribe el nombre de la cuenta");
    const data = {
      codigo, nombre, clase: Number(codigo[0]),
      naturaleza: !naturaleza || naturaleza === "auto" ? u.natDefault(codigo) : naturaleza,
      categorias: (categorias || []).map(s => s.trim().toLowerCase()).filter(Boolean),
      actualizadoEn: new Date()
    };
    if (!S.planMap[codigo]) { data.activa = true; data.origen = "manual"; data.creadoEn = new Date(); }
    await db.collection("planCuentas").doc(codigo).set(data, { merge: true });
    await loadPlan();
  }

  async function alternarCuenta(codigo) {
    const a = S.planMap[codigo];
    if (!a) return;
    await db.collection("planCuentas").doc(codigo).update({ activa: a.activa === false });
    await loadPlan();
  }

  async function vincularBanco(id, codigo) {
    await db.collection("cuentasBancarias").doc(id).update({ cuentaContable: codigo });
    const b = S.bancos.find(x => x.id === id);
    if (b) b.cuentaContable = codigo;
  }

  // Asiento manual. `lineas`: [{codigo, debe, haber}]. Lanza Error si no cuadra.
  async function guardarAsiento({ fecha, descripcion, lineas }) {
    const desc = String(descripcion || "").trim();
    if (!desc) throw new Error("Escribe una descripción");
    if (!fecha) throw new Error("Elige la fecha");
    if (!lineas || lineas.length < 2 || lineas.some(l => !l.codigo)) throw new Error("Cada línea necesita una cuenta (mínimo 2 líneas)");
    if (lineas.some(l => (l.debe > 0) === (l.haber > 0))) throw new Error("Cada línea debe tener Debe o Haber (uno solo)");
    const d = lineas.reduce((a, l) => a + l.debe, 0), h = lineas.reduce((a, l) => a + l.haber, 0);
    if (!(d > 0) || Math.abs(d - h) > 0.005) throw new Error("El asiento no cuadra");
    await db.collection("asientos").add({
      fecha: new Date(fecha + "T12:00:00"), descripcion: desc, origen: { tipo: "manual", id: null },
      lineas: lineas.map(l => ({ codigo: l.codigo, nombre: (S.planMap[l.codigo] || {}).nombre || "", debe: l.debe, haber: l.haber })),
      totalDebe: d, totalHaber: h, creadoEn: new Date(), creadoPor: u.usuario()
    });
  }

  // Saldos iniciales de bancos + asientos de los movimientos realizados que aún no tienen.
  // Devuelve { aperturas, generados, problemas[] }.
  async function generarHistorico() {
    await cargarTodo();
    const problemas = [];
    let aperturas = 0, generados = 0;
    if (!S.plan.length) return { aperturas, generados, problemas: ["El plan de cuentas está vacío"] };

    for (const b of S.bancos) {
      const id = "apertura_" + b.id;
      if (S.asientoIds.has(id)) continue;
      const movsB = S.movs.filter(m => m.cuentaId === b.id && (m.estado || "realizado") === "realizado");
      const neto = movsB.reduce((a, m) => a + (m.tipo === "ingreso" ? 1 : -1) * Number(m.monto || 0), 0);
      const s0 = Number(b.saldo || 0) - neto;          // saldo con el que arrancó la cuenta
      if (Math.abs(s0) < 0.5) continue;
      const cb = codigoBanco(b);
      if (!S.planMap[cb] || !S.planMap["3105"]) { problemas.push(`Saldo inicial de “${b.nombre}”: falta la cuenta ${!S.planMap[cb] ? cb : "3105"} en el plan`); continue; }
      const fechas = movsB.map(m => u.toD(m.fecha)).filter(Boolean).sort((a, z) => a - z);
      const f = fechas.length ? new Date(fechas[0].getTime() - 86400000) : (u.toD(b.creadoEn) || new Date());
      const monto = Math.abs(s0);
      const lb = { codigo: cb, nombre: S.planMap[cb].nombre, debe: s0 > 0 ? monto : 0, haber: s0 > 0 ? 0 : monto };
      const lc = { codigo: "3105", nombre: S.planMap["3105"].nombre, debe: s0 > 0 ? 0 : monto, haber: s0 > 0 ? monto : 0 };
      try {
        await db.collection("asientos").doc(id).set({
          fecha: f, descripcion: `Saldo inicial — ${b.nombre}`, origen: { tipo: "apertura", id: b.id },
          lineas: s0 > 0 ? [lb, lc] : [lc, lb], totalDebe: monto, totalHaber: monto, creadoEn: new Date(), creadoPor: u.usuario()
        });
        S.asientoIds.add(id); aperturas++;
      } catch (e) { problemas.push(`Saldo inicial de “${b.nombre}”: ${e.message || e}`); }
    }

    for (const m of S.movs.filter(m => !m.asientoId && (m.estado || "realizado") === "realizado")) {
      try {
        const r = await registrarMovimiento(m.id, m);
        if (r.ok) generados++; else problemas.push(`“${m.descripcion || m.id}”: ${r.motivo}`);
      } catch (e) { problemas.push(`“${m.descripcion || m.id}”: ${e.message || e}`); }
    }
    return { aperturas, generados, problemas };
  }

  Object.assign(Libro, {
    codigoBanco, cuentaPorCategoria,
    loadPlan, loadBancos, cargarTodo,
    mayor, saldoCuenta, datosBalance,
    resolver, registrarMovimiento, quitarMovimiento, eliminarAsientos, sinAsiento, huerfanos,
    cargarPUC, importarPlanTexto, guardarCuenta, alternarCuenta, vincularBanco, guardarAsiento, generarHistorico
  });
})();

// ════════════════════════════════════════════════════════════════════════════
// PARTE 2 · EXPORTAR (Excel, CSV, PDF)
// ════════════════════════════════════════════════════════════════════════════
(() => {
  "use strict";
  const Libro = window.Libro;
  const { S, u, CLASES } = Libro;

  // ── Tablas de datos (una fila por línea) ───────────────────────────────────
  function filasDiario() {
    const out = [];
    for (const a of S.asientos) {
      const f = u.toD(a.fecha);
      for (const l of a.lineas || []) {
        out.push({
          Fecha: u.fechaCorta(f), Asiento: a.id, Descripción: a.descripcion || "", Origen: (a.origen && a.origen.tipo) || "",
          Código: l.codigo, Cuenta: l.nombre || (S.planMap[l.codigo] || {}).nombre || "",
          Debe: Number(l.debe || 0), Haber: Number(l.haber || 0)
        });
      }
    }
    return out;
  }

  function filasMayor() {
    const m = Libro.mayor({});
    const out = [];
    for (const cod of Object.keys(m).sort()) {
      const acc = S.planMap[cod] || { nombre: "(no está en el plan)", naturaleza: u.natDefault(cod) };
      let acum = 0;
      for (const l of m[cod].lineas) {
        acum += acc.naturaleza === "debito" ? l.debe - l.haber : l.haber - l.debe;
        out.push({ Código: cod, Cuenta: acc.nombre, Naturaleza: acc.naturaleza, Fecha: u.fechaCorta(l.fecha), Descripción: l.desc || "", Debe: l.debe, Haber: l.haber, "Saldo acumulado": acum });
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
    return S.plan.map(a => ({
      Código: a.codigo, Cuenta: a.nombre, Clase: CLASES[a.clase] || "", Naturaleza: a.naturaleza,
      "Categorías por defecto": (a.categorias || []).join(", "), Activa: a.activa === false ? "No" : "Sí"
    }));
  }

  // ── Descarga ───────────────────────────────────────────────────────────────
  const corteOHoy = c => c || u.finDia(u.hoyISO());

  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function csv(tipo, corte) {
    const filas = tipo === "balance" ? filasBalance(Libro.datosBalance(corteOHoy(corte))) : tipo === "plan" ? filasPlan() : filasDiario();
    if (!filas.length) { alert("No hay datos para exportar."); return; }
    const cols = Object.keys(filas[0]);
    const texto = [cols, ...filas.map(r => cols.map(c => r[c]))]
      .map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    descargar(new Blob(["\uFEFF" + texto], { type: "text/csv;charset=utf-8;" }), `DOMKA_${tipo}_${u.hoyISO()}.csv`);
  }

  function excel(corte) {
    if (!window.XLSX) { alert("No se pudo cargar la librería de Excel. Revisa tu conexión."); return; }
    const wb = XLSX.utils.book_new();
    const hoja = (nombre, filas) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas.length ? filas : [{ Info: "Sin datos" }]), nombre);
    hoja("Plan de cuentas", filasPlan());
    hoja("Libro diario", filasDiario());
    hoja("Cuentas T (mayor)", filasMayor());
    hoja("Balance", filasBalance(Libro.datosBalance(corteOHoy(corte))));
    XLSX.writeFile(wb, `DOMKA_libro_contable_${u.hoyISO()}.xlsx`);
  }

  function cargarScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }

  async function pdf(corte) {
    try {
      if (!window.pdfMake) {
        await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js");
        await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js");
      }
    } catch (e) { alert(e.message); return; }
    const fin = corteOHoy(corte);
    const b = Libro.datosBalance(fin);
    const tabla = (titulo, arr, total, extra = []) => [
      { text: titulo, style: "h2" },
      { table: { widths: [50, "*", 90], body: [
        ...arr.map(x => [x.cod, x.nombre, { text: u.fm(x.saldo), alignment: "right" }]),
        ...extra.map(x => ["", x[0], { text: u.fm(x[1]), alignment: "right" }]),
        [{ text: "", border: [false, true, false, false] }, { text: "Total " + titulo.toLowerCase(), bold: true, border: [false, true, false, false] }, { text: u.fm(total), bold: true, alignment: "right", border: [false, true, false, false] }]
      ] }, layout: "lightHorizontalLines", margin: [0, 0, 0, 12] }
    ];
    pdfMake.createPdf({
      pageSize: "LETTER", pageMargins: [40, 50, 40, 50],
      content: [
        { text: "DOMKA CONSTRUCCIONES", style: "h1" },
        { text: `Balance general — corte a ${u.fechaCorta(fin)}`, margin: [0, 0, 0, 14], color: "#5a5a5a" },
        ...tabla("Activo", b.g[1], b.activo),
        ...tabla("Pasivo", b.g[2], b.pasivo),
        ...tabla("Patrimonio", b.g[3], b.patrimonio, [["Resultado acumulado", b.resultado]]),
        { text: `Pasivo + Patrimonio: ${u.fm(b.pasivo + b.patrimonio)} — ${Math.abs(b.diff) < 0.5 ? "el balance cuadra" : "diferencia " + u.fm(Math.abs(b.diff))}`, bold: true }
      ],
      styles: { h1: { fontSize: 16, bold: true, color: "#155c3c" }, h2: { fontSize: 12, bold: true, margin: [0, 6, 0, 4], color: "#1b7a51" } },
      defaultStyle: { fontSize: 9 }
    }).download(`DOMKA_balance_${u.hoyISO()}.pdf`);
  }

  Libro.exportar = { excel, csv, pdf };
})();

// ════════════════════════════════════════════════════════════════════════════
// PARTE 3 · PANTALLA (totales, cuentas T, balance, plan, modal, formulario)
// ════════════════════════════════════════════════════════════════════════════
(() => {
  "use strict";
  const Libro = window.Libro;
  const { S, u, CLASES } = Libro;
  const { esc, fm, fechaCorta } = u;
  const $ = id => document.getElementById(id);

  // ── 1. ESTADO DE PANTALLA Y AYUDAS ─────────────────────────────────────────
  const V = { sub: "cuentas", sel: null, q: "", todas: false, periodo: "todo", pq: "", editando: null, formPlan: false, avanzado: false, cache: null };

  function rango() {
    const hoy = new Date();
    if (V.periodo === "mes") return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: null };
    if (V.periodo === "anio") return { desde: new Date(hoy.getFullYear(), 0, 1), hasta: null };
    if (V.periodo === "rango") return { desde: u.inicioDia($("lb-desde").value), hasta: u.finDia($("lb-hasta").value) };
    return { desde: null, hasta: null };
  }
  const corte = () => rango().hasta || u.finDia(u.hoyISO());
  const configurado = () => S.plan.length > 0;

  const claseDe = cod => Number(String(cod)[0]);
  const lado = (acc, columna) => ((acc.naturaleza || u.natDefault(acc.codigo)) === (columna === "debe" ? "debito" : "credito") ? "aumenta" : "disminuye");

  function ocupado(msg) { document.body.style.cursor = msg ? "progress" : ""; }
  function aviso(msg) { alert(msg); }

  // ── 2. BARRA, TOTALES Y AVISOS ─────────────────────────────────────────────
  function renderBarra() {
    document.querySelectorAll("#lb-seg button").forEach(b => b.classList.toggle("on", b.dataset.sub === V.sub));
    $("lb-rango").classList.toggle("hidden", V.periodo !== "rango");
  }

  function renderKpis() {
    const box = $("lb-kpis");
    if (!configurado()) { box.innerHTML = ""; return; }
    const b = Libro.datosBalance(corte());
    const ok = Math.abs(b.diff) < 0.5;
    const tarjeta = (titulo, valor, sub, cls = "") => `<div class="lb-kpi ${cls}"><div class="lb-kpi-t">${titulo}</div><div class="lb-kpi-v">${fm(valor)}</div><div class="lb-kpi-s">${sub}</div></div>`;
    box.innerHTML =
      tarjeta("Lo que tienes", b.activo, "Activo") +
      tarjeta("Lo que debes", b.pasivo, "Pasivo") +
      tarjeta("Lo que es tuyo", b.patrimonio, "Patrimonio") +
      tarjeta(b.resultado >= 0 ? "Utilidad" : "Pérdida", Math.abs(b.resultado),
        ok ? "✓ Todo cuadra" : `✗ No cuadra: ${fm(Math.abs(b.diff))}`, ok ? (b.resultado >= 0 ? "ok" : "bad") : "bad");
  }

  function renderAviso() {
    const cont = $("lb-aviso");
    if (!configurado()) { cont.innerHTML = ""; return; }
    let html = "";

    const huer = Libro.huerfanos();
    if (huer.length) {
      html += `<div class="lb-aviso lb-aviso-w"><span>Hay ${huer.length} asiento(s) de movimientos que ya no existen.</span>
        <button class="btn btn-orange btn-sm" data-lb="limpiar">Limpiar</button></div>`;
    }

    const pend = Libro.sinAsiento();
    if (pend.length) {
      const reales = pend.filter(p => p.estado === "realizado");
      const resumen = reales.length
        ? `${reales.length} movimiento(s) realizados no están en el libro` + (pend.length > reales.length ? ` · ${pend.length - reales.length} pendientes o programados` : "")
        : `${pend.length} movimiento(s) pendientes o programados aún no entran al libro`;
      const filas = pend.slice(0, 40).map(p => {
        const m = p.mov, f = u.toD(m.fecha);
        let accion = "";
        if (p.estado === "realizado" && (p.necesitaContra || p.listo)) {
          accion = (p.necesitaContra ? `<select id="lb-fix-${m.id}" class="inp lb-fix">${opcionesContra(m.tipo, "")}</select>` : "") +
            `<button class="btn btn-orange btn-sm" data-lb="registrar" data-id="${m.id}">Registrar</button>`;
        } else if (p.estado !== "realizado" && m.cuentaId) {
          accion = (!m.cuentaContable ? `<select id="lb-fix-${m.id}" class="inp lb-fix">${opcionesContra(m.tipo, "")}</select>` : "") +
            `<button class="btn btn-gray btn-sm" data-lb="registrar" data-id="${m.id}" data-realizar="1">Marcar realizado</button>`;
        } else if (!m.cuentaId) {
          accion = `<button class="btn btn-gray btn-sm" data-lb="asiento-de-mov" data-id="${m.id}">Anotar a mano</button>`;
        }
        return `<div class="lb-pend">
          <div class="lb-pend-i"><b>${esc(m.descripcion || "—")}</b> <span class="lb-mini">${fechaCorta(f)} · ${esc(p.estado)}</span>
            <div class="lb-mini">${esc(p.motivo)}</div></div>
          <div class="lb-pend-m ${m.tipo === "ingreso" ? "pos" : "neg"}">${m.tipo === "ingreso" ? "+" : "−"}${fm(m.monto)}</div>
          <div class="lb-pend-a">${accion}</div></div>`;
      }).join("");
      html += `<details class="lb-det-aviso" ${reales.length ? "open" : ""}>
        <summary class="${reales.length ? "lb-warn-t" : ""}">${esc(resumen)}</summary>
        ${reales.length > 1 ? `<div class="lb-pend-top"><button class="btn btn-gray btn-sm" data-lb="historico">Registrar todos los que se puedan</button></div>` : ""}
        ${filas}${pend.length > 40 ? `<p class="lb-mini">Mostrando 40 de ${pend.length}.</p>` : ""}</details>`;
    }
    cont.innerHTML = html;
  }

  // ── 3. SECCIÓN CUENTAS T (lista + detalle) ─────────────────────────────────
  function filaInfo(cod, m) {
    const acc = S.planMap[cod] || { codigo: cod, nombre: "(cuenta fuera del plan)", naturaleza: u.natDefault(cod) };
    const r = m[cod] || { antDebe: 0, antHaber: 0, debe: 0, haber: 0, lineas: [] };
    const tiene = r.lineas.length > 0 || r.antDebe > 0 || r.antHaber > 0;
    return { cod, acc, r, tiene, saldo: Libro.saldoCuenta(acc, r) };
  }

  function listaVisible() {
    const m = V.cache;
    const q = V.q.trim().toLowerCase();
    const codigos = [...new Set([...S.plan.filter(a => a.activa !== false).map(a => a.codigo), ...Object.keys(m)])].sort();
    return codigos.map(c => filaInfo(c, m)).filter(f =>
      (V.todas || f.tiene) && (!q || f.cod.includes(q) || f.acc.nombre.toLowerCase().includes(q)));
  }

  function renderLista() {
    const items = listaVisible();
    const grupos = {};
    items.forEach(f => { (grupos[claseDe(f.cod)] ||= []).push(f); });
    let html = "";
    for (const c of [1, 2, 3, 4, 5, 6, 7]) {
      if (!grupos[c]) continue;
      html += `<div class="lb-grp">${CLASES[c]}</div>` + grupos[c].map(f =>
        `<button type="button" class="lb-item ${f.cod === V.sel ? "on" : ""}" data-lb="sel" data-cod="${esc(f.cod)}">
           <span class="lb-item-n">${esc(f.acc.nombre)}<small>${esc(f.cod)}</small></span>
           <span class="${f.saldo < -0.5 ? "lb-warn" : ""}">${fm(Math.abs(f.saldo))}</span></button>`).join("");
    }
    $("lb-lista").innerHTML = html || `<p class="lb-mini lb-pad">Sin cuentas con movimiento en este período.</p>`;
  }

  function renderDetalle() {
    const box = $("lb-detalle");
    const items = listaVisible();
    if (!V.sel || !items.some(f => f.cod === V.sel)) V.sel = (items.find(f => f.cod === "1110") || items[0] || {}).cod || null;
    renderLista();
    if (!V.sel) {
      box.innerHTML = `<div class="lb-vacio"><i class="fas fa-book"></i><p>Aún no hay movimientos en el libro.</p><p class="lb-mini">Registra un ingreso o un gasto, o anota un asiento a mano.</p></div>`;
      return;
    }
    const { acc, r, saldo } = filaInfo(V.sel, V.cache);
    const net = (r.antDebe + r.debe) - (r.antHaber + r.haber);
    const ant = r.antDebe - r.antHaber;
    const fila = (l, key) => {
      const borrable = l.origen === "manual" || l.origen === "apertura";
      return `<div class="lb-e" title="${esc(l.desc || "")}"><span class="lb-e-f">${fechaCorta(l.fecha).slice(0, 5)}</span>
        <span class="lb-e-d">${esc(l.desc || "—")}</span><b>${fm(l[key])}</b>
        ${borrable ? `<button class="lb-x" title="Eliminar asiento" data-lb="borrar-asiento" data-id="${esc(l.asientoId)}"><i class="fas fa-trash"></i></button>` : ""}</div>`;
    };
    const col = (key, titulo) => `<div class="lb-tc"><div class="lb-tc-h">${titulo}<small>${lado(acc, key)}</small></div>
      ${key === "debe" && ant > 0 ? `<div class="lb-e lb-e-ant"><span class="lb-e-d">Saldo anterior</span><b>${fm(ant)}</b></div>` : ""}
      ${key === "haber" && ant < 0 ? `<div class="lb-e lb-e-ant"><span class="lb-e-d">Saldo anterior</span><b>${fm(-ant)}</b></div>` : ""}
      ${r.lineas.filter(l => l[key] > 0).map(l => fila(l, key)).join("")}</div>`;
    box.innerHTML = `
      <div class="lb-det-head">
        <div><div class="lb-det-t">${esc(acc.nombre)} <span class="lb-cod">${esc(acc.codigo)}</span></div>
          <div class="lb-mini">Naturaleza ${acc.naturaleza === "debito" ? "débito (aumenta por el Debe)" : "crédito (aumenta por el Haber)"}</div></div>
        <div class="lb-det-s"><span class="lb-mini">Saldo ${net >= 0 ? "deudor" : "acreedor"}</span>
          <div class="lb-det-v ${saldo < -0.5 ? "lb-warn" : ""}">${fm(Math.abs(net))}</div>
          ${saldo < -0.5 ? `<div class="lb-mini lb-warn">Contrario a su naturaleza: revísalo</div>` : ""}</div>
      </div>
      <div class="lb-t">${col("debe", "Debe")}${col("haber", "Haber")}</div>
      <div class="lb-t-foot"><span>Total Debe <b>${fm(r.antDebe + r.debe)}</b></span><span>Total Haber <b>${fm(r.antHaber + r.haber)}</b></span></div>
      <div class="lb-det-act"><button class="btn btn-gray btn-sm" data-lb="nuevo-asiento" data-cod="${esc(acc.codigo)}"><i class="fas fa-plus"></i> Registrar asiento con esta cuenta</button></div>`;
  }

  function renderCuentas() {
    const r = rango();
    V.cache = Libro.mayor({ desde: r.desde, hasta: r.hasta });
    $("lb-sec-cuentas").innerHTML = `<div class="lb-md">
      <aside class="lb-side">
        <input id="lb-q" class="inp" placeholder="Buscar cuenta" value="${esc(V.q)}" autocomplete="off">
        <div id="lb-lista"></div>
        <button type="button" class="lb-link lb-pad" data-lb="todas">${V.todas ? "Ocultar cuentas sin movimiento" : "Ver todas las cuentas"}</button>
      </aside>
      <div id="lb-detalle" class="lb-det"></div></div>`;
    renderDetalle();
  }

  // ── 4. SECCIÓN BALANCE ─────────────────────────────────────────────────────
  function renderBalance() {
    const fin = corte();
    const b = Libro.datosBalance(fin);
    const ok = Math.abs(b.diff) < 0.5;
    const lineas = arr => arr.map(x => `<div class="lb-bal-row"><span><span class="lb-cod">${esc(x.cod)}</span>${esc(x.nombre)}</span><b>${fm(x.saldo)}</b></div>`).join("") || `<p class="lb-mini">Sin saldos</p>`;
    $("lb-sec-balance").innerHTML = `
      <p class="lb-mini lb-nota">Balance al ${fechaCorta(fin)}. Con el selector de período de arriba cambias la fecha de corte.</p>
      <div class="lb-bal">
        <div class="lb-card"><h3>Activo <small>lo que tienes</small></h3>${lineas(b.g[1])}
          <div class="lb-bal-tot"><span>Total activo</span><span>${fm(b.activo)}</span></div></div>
        <div class="lb-card"><h3>Pasivo <small>lo que debes</small></h3>${lineas(b.g[2])}
          <div class="lb-bal-tot"><span>Total pasivo</span><span>${fm(b.pasivo)}</span></div>
          <h3 class="lb-h3-2">Patrimonio <small>lo que es tuyo</small></h3>${lineas(b.g[3])}
          <div class="lb-bal-row"><span><i>Resultado acumulado</i></span><b>${fm(b.resultado)}</b></div>
          <div class="lb-bal-tot"><span>Total patrimonio</span><span>${fm(b.patrimonio)}</span></div>
          <div class="lb-bal-tot lb-bal-sum"><span>Pasivo + Patrimonio</span><span>${fm(b.pasivo + b.patrimonio)}</span></div></div>
      </div>
      <div class="lb-card lb-chk ${ok ? "ok" : "bad"}"><b>${ok ? "✓ El balance cuadra: Activo = Pasivo + Patrimonio" : `✗ No cuadra: diferencia de ${fm(Math.abs(b.diff))}`}</b>
        <div class="lb-mini">Ingresos ${fm(b.ing)} − costos ${fm(b.cos)} − gastos ${fm(b.gas)} = ${b.resultado >= 0 ? "utilidad" : "pérdida"} de ${fm(Math.abs(b.resultado))}</div></div>`;
  }

  // ── 5. CONFIGURACIÓN INICIAL (un solo botón) ───────────────────────────────
  function renderConfiguracion() {
    return `<div class="lb-setup">
      <i class="fas fa-book-open"></i>
      <h3>Configura tu libro contable</h3>
      <p>Un clic y queda listo: carga las ${Libro.PUC_BASE.length} cuentas base (PUC), crea el saldo inicial de cada cuenta bancaria y registra los movimientos que ya tienes.</p>
      <button class="btn btn-orange" data-lb="configurar"><i class="fas fa-wand-magic-sparkles"></i> Configurar automáticamente</button>
      <p class="lb-mini"><button type="button" class="lb-link" data-lb="sub" data-sub="plan">Prefiero cargar mi propio plan de cuentas</button></p></div>`;
  }

  async function configurar() {
    if (!confirm(`Voy a dejar el libro listo:\n\n• Cargar ${Libro.PUC_BASE.length} cuentas base (puedes editarlas después)\n• Crear el saldo inicial de cada cuenta bancaria\n• Registrar los movimientos realizados que ya tienes\n\nNo duplica nada si lo repites. ¿Continuar?`)) return;
    ocupado(true);
    try {
      await Libro.cargarPUC();
      const r = await Libro.generarHistorico();
      await refrescar();
      aviso(`✅ Libro configurado\n\nSaldos iniciales: ${r.aperturas}\nMovimientos registrados: ${r.generados}` +
        (r.problemas.length ? `\n\n⚠️ ${r.problemas.length} sin registrar (los verás en el aviso de arriba):\n• ` + r.problemas.slice(0, 6).join("\n• ") : ""));
    } catch (e) { aviso("No se pudo configurar: " + (e.message || e)); }
    ocupado(false);
  }

  // ── 6. SECCIÓN PLAN DE CUENTAS ─────────────────────────────────────────────
  function renderPlanTabla() {
    const q = V.pq.trim().toLowerCase();
    const filas = S.plan.filter(a => !q || a.codigo.includes(q) || a.nombre.toLowerCase().includes(q));
    $("lb-plan-tbody").innerHTML = filas.map(a => `<tr class="${a.activa === false ? "lb-off" : ""}">
      <td><span class="lb-cod">${esc(a.codigo)}</span></td><td>${esc(a.nombre)}</td>
      <td>${a.naturaleza === "debito" ? "Débito" : "Crédito"}</td>
      <td class="lb-mini">${esc((a.categorias || []).join(", "))}</td>
      <td class="lb-acc"><button class="lb-link" data-lb="plan-editar" data-cod="${esc(a.codigo)}">Editar</button>
        <button class="lb-link" data-lb="plan-toggle" data-cod="${esc(a.codigo)}">${a.activa === false ? "Activar" : "Inactivar"}</button></td></tr>`).join("") ||
      `<tr><td colspan="5" class="lb-mini lb-pad">Sin resultados.</td></tr>`;
  }

  function renderPlan() {
    const ed = V.editando ? S.planMap[V.editando] : null;
    const opcBanco = sel => S.plan.filter(a => a.activa !== false && (a.codigo[0] === "1" || a.codigo[0] === "2"))
      .map(a => `<option value="${esc(a.codigo)}"${a.codigo === sel ? " selected" : ""}>${esc(a.codigo)} — ${esc(a.nombre)}</option>`).join("");
    $("lb-sec-plan").innerHTML = `
      <div class="lb-plan-bar">
        <input id="lb-pq" class="inp" placeholder="Buscar en el plan" value="${esc(V.pq)}" autocomplete="off">
        <button class="btn btn-orange btn-sm" data-lb="plan-nueva"><i class="fas fa-plus"></i> Agregar cuenta</button>
        <button class="btn btn-gray btn-sm" data-lb="plan-puc"><i class="fas fa-download"></i> Cargar PUC base</button>
        <label class="btn btn-gray btn-sm lb-file"><i class="fas fa-file-import"></i> Importar CSV
          <input id="lb-plan-csv" type="file" accept=".csv,.txt" class="hidden"></label>
      </div>
      <div class="lb-card lb-form ${V.formPlan ? "" : "hidden"}">
        <h3>${ed ? "Editar cuenta " + esc(ed.codigo) : "Agregar cuenta"}</h3>
        <div class="lb-form-g">
          <div><label class="lbl">Código *</label><input id="lb-pc-codigo" class="inp" placeholder="Ej: 1110" inputmode="numeric" value="${ed ? esc(ed.codigo) : ""}" ${ed ? "readonly" : ""}></div>
          <div><label class="lbl">Nombre *</label><input id="lb-pc-nombre" class="inp" placeholder="Ej: Bancos" spellcheck="true" lang="es" value="${ed ? esc(ed.nombre) : ""}"></div>
          <div><label class="lbl">Naturaleza</label><select id="lb-pc-nat" class="inp">
            <option value="auto">Automática (según la clase)</option>
            <option value="debito" ${ed && ed.naturaleza === "debito" ? "selected" : ""}>Débito</option>
            <option value="credito" ${ed && ed.naturaleza === "credito" ? "selected" : ""}>Crédito</option></select></div>
          <div><label class="lbl">Categorías que van aquí</label><input id="lb-pc-cats" class="inp" placeholder="Ej: vivienda, servicios-publicos" value="${ed ? esc((ed.categorias || []).join(", ")) : ""}"></div>
        </div>
        <div class="lb-form-b"><button class="btn btn-orange btn-sm" data-lb="plan-guardar"><i class="fas fa-save"></i> Guardar</button>
          <button class="btn btn-gray btn-sm" data-lb="plan-cancelar">Cancelar</button></div>
      </div>
      <div class="lb-card lb-tabla"><table><thead><tr><th>Código</th><th>Nombre</th><th>Naturaleza</th><th>Categorías por defecto</th><th></th></tr></thead>
        <tbody id="lb-plan-tbody"></tbody></table></div>
      <details class="lb-card lb-bancos"><summary>Cuentas bancarias → cuenta contable</summary>
        ${S.bancos.length ? S.bancos.map(b => `<div class="lb-banco"><span>${esc(b.nombre)} <small class="lb-mini">(${esc(b.tipo || "cuenta")})</small></span>
          <select class="inp" data-lb-banco="${b.id}">${opcBanco(Libro.codigoBanco(b))}</select></div>`).join("")
          : `<p class="lb-mini">Aún no tienes cuentas bancarias (pestaña Mis Cuentas).</p>`}
        <p class="lb-mini">Si no eliges, se usa 1105 Caja, 1110 Bancos o 1120 Ahorros según el tipo de cuenta.</p></details>`;
    renderPlanTabla();
  }

  async function guardarCuenta() {
    try {
      await Libro.guardarCuenta({
        codigo: $("lb-pc-codigo").value, nombre: $("lb-pc-nombre").value, naturaleza: $("lb-pc-nat").value,
        categorias: $("lb-pc-cats").value.split(",")
      });
      V.formPlan = false; V.editando = null;
      await refrescar();
    } catch (e) { aviso(e.message || String(e)); }
  }

  // ── 7. MODAL "REGISTRAR ASIENTO" (simple por defecto; avanzado = varias líneas) ──
  function opcionesTodas(sel) {
    return `<option value="">Elige una cuenta</option>` + [1, 2, 3, 4, 5, 6, 7].map(c => {
      const cs = S.plan.filter(a => a.activa !== false && claseDe(a.codigo) === c);
      return cs.length ? `<optgroup label="${CLASES[c]}">` + cs.map(a => `<option value="${esc(a.codigo)}"${a.codigo === sel ? " selected" : ""}>${esc(a.codigo)} — ${esc(a.nombre)}</option>`).join("") + `</optgroup>` : "";
    }).join("");
  }

  function modalError(msg) { const e = $("lb-as-error"); e.textContent = msg || ""; e.classList.toggle("hidden", !msg); }

  function agregarLinea(cod, debe, haber) {
    const div = document.createElement("div");
    div.className = "lb-linea";
    div.innerHTML = `<select class="inp as-cta">${opcionesTodas(cod)}</select>
      <input type="number" min="0" step="any" class="inp as-debe" placeholder="Debe" value="${debe || ""}">
      <input type="number" min="0" step="any" class="inp as-haber" placeholder="Haber" value="${haber || ""}">
      <button type="button" class="lb-x" title="Quitar" data-lb="as-quitar">✕</button>`;
    $("lb-as-lineas").appendChild(div);
  }

  function lineasAvanzadas() {
    return [...document.querySelectorAll("#lb-as-lineas .lb-linea")].map(r => ({
      codigo: r.querySelector(".as-cta").value,
      debe: Number(r.querySelector(".as-debe").value) || 0,
      haber: Number(r.querySelector(".as-haber").value) || 0
    }));
  }

  function totalesModal() {
    const ls = lineasAvanzadas();
    const d = ls.reduce((a, l) => a + l.debe, 0), h = ls.reduce((a, l) => a + l.haber, 0);
    const ok = d > 0 && Math.abs(d - h) < 0.005;
    $("lb-as-totales").innerHTML = `Debe <b>${fm(d)}</b> · Haber <b>${fm(h)}</b> · <span class="${ok ? "lb-ok-t" : "lb-warn"}">${ok ? "✓ Cuadra" : `Diferencia ${fm(Math.abs(d - h))}`}</span>`;
  }

  function modoAvanzado(si) {
    V.avanzado = si;
    $("lb-as-simple").classList.toggle("hidden", si);
    $("lb-as-avanzado").classList.toggle("hidden", !si);
    $("lb-as-modo").textContent = si ? "Volver al modo simple" : "Avanzado: varias líneas";
    modalError("");
    if (si) {
      $("lb-as-lineas").innerHTML = "";
      const monto = Number($("lb-as-monto").value) || 0;
      agregarLinea($("lb-as-debe").value, monto, "");
      agregarLinea($("lb-as-haber").value, "", monto);
      totalesModal();
    }
  }

  function abrirAsiento(pref = {}) {
    if (!configurado()) { aviso("Primero configura el libro contable."); return; }
    $("lb-as-fecha").value = pref.fecha || u.hoyISO();
    $("lb-as-desc").value = pref.desc || "";
    $("lb-as-debe").innerHTML = opcionesTodas(pref.cod || "");
    $("lb-as-haber").innerHTML = opcionesTodas("");
    $("lb-as-monto").value = pref.monto || "";
    modoAvanzado(false);
    $("lb-modal").classList.remove("hidden");
    $("lb-as-desc").focus();
  }
  const cerrarModal = () => $("lb-modal").classList.add("hidden");

  async function guardarAsiento() {
    let lineas;
    if (V.avanzado) lineas = lineasAvanzadas();
    else {
      const monto = Number($("lb-as-monto").value) || 0;
      const d = $("lb-as-debe").value, h = $("lb-as-haber").value;
      if (!d || !h) return modalError("Elige la cuenta que recibe y la que da");
      if (d === h) return modalError("Las dos cuentas no pueden ser la misma");
      if (!(monto > 0)) return modalError("Escribe el monto");
      lineas = [{ codigo: d, debe: monto, haber: 0 }, { codigo: h, debe: 0, haber: monto }];
    }
    try {
      await Libro.guardarAsiento({ fecha: $("lb-as-fecha").value, descripcion: $("lb-as-desc").value, lineas });
      cerrarModal();
      await refrescar();
    } catch (e) { modalError(e.message || String(e)); }
  }

  // ── 8. FORMULARIO DE MOVIMIENTOS ("Se registra en…") ───────────────────────
  const tipoMovActual = () => { const r = document.querySelector('input[name="tipo-mov"]:checked'); return r ? r.value : "ingreso"; };

  function opcionesContra(tipo, valor) {
    const orden = tipo === "ingreso" ? [4, 2, 3, 1, 5, 6, 7] : [5, 7, 6, 2, 1, 3, 4];
    let html = `<option value="">Automática (según categoría)</option>`;
    for (const c of orden) {
      const cs = S.plan.filter(a => a.activa !== false && claseDe(a.codigo) === c);
      if (!cs.length) continue;
      html += `<optgroup label="${c} · ${CLASES[c]}">` + cs.map(a => `<option value="${esc(a.codigo)}"${a.codigo === valor ? " selected" : ""}>${esc(a.codigo)} — ${esc(a.nombre)}</option>`).join("") + `</optgroup>`;
    }
    return html;
  }

  function poblarSelectContable(auto) {
    const sel = $("mov-cuenta-contable");
    if (!sel) return;
    const prev = auto ? "" : sel.value;
    sel.innerHTML = opcionesContra(tipoMovActual(), prev);
    sel.value = [...sel.options].some(o => o.value === prev) ? prev : "";
  }

  let _intentosBanco = 0;
  function actualizarDestino() {
    const el = $("mov-destino");
    if (!el) return;
    const sel = $("mov-cuenta-contable");
    const estado = ($("mov-estado") || {}).value || "realizado";
    const bankId = ($("mov-cuenta-bancaria") || {}).value;
    const poner = (html, cls) => { el.className = "lb-dest-txt " + (cls || ""); el.innerHTML = html; };

    if (!configurado()) return poner("Configura el libro contable para que pase solo.", "lb-dest-info");
    if (estado !== "realizado") return poner(`Pasará al libro cuando esté realizado.`, "lb-dest-info");
    if (!bankId) return poner("Elige una cuenta bancaria para que pase al libro.", "lb-dest-warn");
    if (!S.bancos.find(b => b.id === bankId)) {
      if (_intentosBanco++ < 2) Libro.loadBancos().then(actualizarDestino);
      return poner("…", "lb-dest-info");
    }
    _intentosBanco = 0;
    const cod = sel.value || Libro.cuentaPorCategoria(($("mov-categoria") || {}).value);
    if (!cod) { sel.classList.remove("hidden"); $("mov-cambiar").classList.add("hidden"); return poner("Elige la cuenta a la que va:", "lb-dest-warn"); }
    const acc = S.planMap[cod];
    poner(acc ? `<b>${esc(acc.nombre)}</b> <small>${esc(cod)}</small>` : `Cuenta ${esc(cod)} (no está en el plan)`, acc ? "lb-dest-ok" : "lb-dest-warn");
  }

  function resetFormMov() {
    const sel = $("mov-cuenta-contable");
    if (sel) sel.classList.add("hidden");
    const b = $("mov-cambiar");
    if (b) b.classList.remove("hidden");
    poblarSelectContable(true);
    actualizarDestino();
  }

  function initFormMovimiento() {
    if (!$("mov-cuenta-contable")) return;
    const cambio = () => { poblarSelectContable(true); actualizarDestino(); };
    const cat = $("mov-categoria");
    if (cat) cat.addEventListener("change", cambio);
    document.querySelectorAll('input[name="tipo-mov"]').forEach(r => r.addEventListener("change", cambio));
    ["mov-estado", "mov-cuenta-bancaria"].forEach(i => { const e = $(i); if (e) e.addEventListener("change", actualizarDestino); });
    $("mov-cuenta-contable").addEventListener("change", actualizarDestino);
    $("mov-cambiar").addEventListener("click", () => { $("mov-cuenta-contable").classList.remove("hidden"); $("mov-cambiar").classList.add("hidden"); });
  }

  // ── 9. ACCIONES (clics) Y ARRANQUE ─────────────────────────────────────────
  function renderTodo() {
    const listo = configurado();
    const enPlan = V.sub === "plan";
    renderBarra();
    renderKpis();
    renderAviso();
    $("lb-sec-cuentas").classList.toggle("hidden", V.sub !== "cuentas" || !listo);
    $("lb-sec-balance").classList.toggle("hidden", V.sub !== "balance" || !listo);
    $("lb-sec-plan").classList.toggle("hidden", !enPlan);
    if (!listo && !enPlan) { $("lb-aviso").innerHTML = renderConfiguracion(); return; }
    if (listo && V.sub === "cuentas") renderCuentas();
    if (listo && V.sub === "balance") renderBalance();
    if (enPlan) renderPlan();
  }

  async function refrescar() {
    try { await Libro.cargarTodo(); }
    catch (e) { console.warn("Libro:", e); $("lb-aviso").innerHTML = `<div class="lb-aviso lb-aviso-w"><span>No se pudo cargar el libro (${esc(e.code || e.message || "error")}). ¿Publicaste las reglas de Firestore?</span></div>`; return; }
    renderTodo();
    poblarSelectContable(false);
    actualizarDestino();
  }

  async function registrarDesdeAviso(id, realizar) {
    const mov = S.movs.find(x => x.id === id);
    if (!mov) return;
    const sel = $("lb-fix-" + id);
    const contra = sel && sel.value ? sel.value : mov.cuentaContable;
    try {
      if (contra && contra !== mov.cuentaContable) await db.collection("movimientos").doc(id).update({ cuentaContable: contra });
      const r = await Libro.registrarMovimiento(id, { ...mov, cuentaContable: contra || null }, { marcarRealizado: !!realizar });
      if (!r.ok) aviso("No se pudo registrar: " + r.motivo);
    } catch (e) { aviso("Error: " + (e.message || e)); }
    await refrescar();
  }

  const acciones = {
    sub: b => { V.sub = b.dataset.sub; renderTodo(); },
    sel: b => { V.sel = b.dataset.cod; renderDetalle(); },
    todas: () => { V.todas = !V.todas; renderCuentas(); },
    "nuevo-asiento": b => abrirAsiento({ cod: b.dataset.cod }),
    "asiento-de-mov": b => {
      const m = S.movs.find(x => x.id === b.dataset.id); if (!m) return;
      const f = u.toD(m.fecha);
      abrirAsiento({ fecha: f ? f.toISOString().slice(0, 10) : null, desc: m.descripcion, monto: Number(m.monto || 0) });
    },
    "borrar-asiento": async b => {
      if (!confirm("¿Eliminar este asiento? Se quita de todas las cuentas que toca.")) return;
      try { await Libro.eliminarAsientos([b.dataset.id]); } catch (e) { aviso("No se pudo eliminar: " + (e.message || e)); }
      await refrescar();
    },
    exp: b => {
      const t = b.dataset.exp;
      document.getElementById("lb-export").open = false;
      if (t === "xlsx") Libro.exportar.excel(corte());
      else if (t === "pdf") Libro.exportar.pdf(corte());
      else Libro.exportar.csv(t.replace("csv-", ""), corte());
    },
    configurar,
    historico: async () => {
      ocupado(true);
      try { const r = await Libro.generarHistorico(); await refrescar(); aviso(`✅ Registrados: ${r.generados}` + (r.problemas.length ? `\n\n⚠️ ${r.problemas.length} siguen sin registrar:\n• ` + r.problemas.slice(0, 6).join("\n• ") : "")); }
      catch (e) { aviso("Error: " + (e.message || e)); }
      ocupado(false);
    },
    registrar: b => registrarDesdeAviso(b.dataset.id, b.dataset.realizar === "1"),
    limpiar: async () => {
      const lista = Libro.huerfanos();
      if (!lista.length || !confirm(`Se eliminarán ${lista.length} asiento(s) de movimientos que ya no existen. ¿Continuar?`)) return;
      try { await Libro.eliminarAsientos(lista.map(a => a.id)); } catch (e) { aviso("No se pudo limpiar: " + (e.message || e)); }
      await refrescar();
    },
    "plan-nueva": () => { V.formPlan = true; V.editando = null; renderPlan(); $("lb-pc-codigo").focus(); },
    "plan-editar": b => { V.formPlan = true; V.editando = b.dataset.cod; renderPlan(); $("lb-pc-nombre").focus(); },
    "plan-cancelar": () => { V.formPlan = false; V.editando = null; renderPlan(); },
    "plan-guardar": guardarCuenta,
    "plan-toggle": async b => { try { await Libro.alternarCuenta(b.dataset.cod); } catch (e) { aviso(e.message || e); } await refrescar(); },
    "plan-puc": async () => {
      if (!confirm(`Se agregarán las cuentas base que te falten (de ${Libro.PUC_BASE.length}). Es un catálogo simplificado: valídalo con tu contador. ¿Continuar?`)) return;
      try { const n = await Libro.cargarPUC(); await refrescar(); aviso(n ? `✅ ${n} cuentas cargadas` : "El PUC base ya estaba cargado."); }
      catch (e) { aviso("Error al cargar: " + (e.message || e)); }
    },
    "as-modo": () => {
      if (!V.avanzado) return modoAvanzado(true);
      const ls = lineasAvanzadas();
      if (ls.length !== 2 || ls.some(l => (l.debe > 0) === (l.haber > 0)) || !ls.some(l => l.debe > 0)) return modalError("Con más de 2 líneas solo se puede en modo avanzado");
      const d = ls.find(l => l.debe > 0), h = ls.find(l => l.haber > 0);
      $("lb-as-debe").value = d.codigo; $("lb-as-haber").value = h.codigo; $("lb-as-monto").value = d.debe;
      modoAvanzado(false);
    },
    "as-agregar": () => { agregarLinea(); totalesModal(); },
    "as-quitar": b => { b.closest(".lb-linea").remove(); totalesModal(); },
    "as-guardar": guardarAsiento,
    "as-cancelar": cerrarModal
  };

  function init() {
    document.addEventListener("click", e => {
      const b = e.target.closest("[data-lb]");
      if (!b) { const m = $("lb-export"); if (m && m.open && !m.contains(e.target)) m.open = false; return; }
      const fn = acciones[b.dataset.lb];
      if (fn) { Promise.resolve(fn(b)).catch(err => { console.warn("Libro:", err); aviso("Error: " + (err.message || err)); }); }
    });
    document.addEventListener("input", e => {
      if (e.target.id === "lb-q") { V.q = e.target.value; renderDetalle(); }
      else if (e.target.id === "lb-pq") { V.pq = e.target.value; renderPlanTabla(); }
      else if (e.target.closest && e.target.closest("#lb-as-lineas")) totalesModal();
    });
    document.addEventListener("change", async e => {
      const t = e.target;
      if (t.id === "lb-periodo") { V.periodo = t.value; renderTodo(); }
      else if (t.id === "lb-desde" || t.id === "lb-hasta") renderTodo();
      else if (t.dataset && t.dataset.lbBanco) {
        try { await Libro.vincularBanco(t.dataset.lbBanco, t.value); actualizarDestino(); } catch (err) { aviso("No se pudo vincular: " + (err.message || err)); }
      } else if (t.id === "lb-plan-csv" && t.files[0]) {
        const f = t.files[0]; t.value = "";
        try {
          const n = await Libro.importarPlanTexto(await f.text());
          await refrescar();
          aviso(n ? `✅ ${n} cuentas importadas` : "No se encontraron cuentas nuevas. Formato: codigo;nombre[;debito|credito]");
        } catch (err) { aviso("Error al importar: " + (err.message || err)); }
      }
    });

    document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => { if (b.dataset.tab === "libro") refrescar(); }));
    initFormMovimiento();
    if (window.auth) {
      auth.onAuthStateChanged(user => {
        if (!user) return;
        Promise.all([Libro.loadPlan(), Libro.loadBancos()]).then(() => { poblarSelectContable(true); actualizarDestino(); }).catch(() => {});
      });
    }
  }

  Libro.resetFormMov = resetFormMov;
  Libro.refrescar = refrescar;
  Libro._ui = { V, rango, renderTodo };
  if (typeof document !== "undefined") init();
})();
