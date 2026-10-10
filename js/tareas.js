// js/tareas.js — Módulo de tareas DOMKA v1.0
// Colección Firestore: "tareas" (ver reglas en rules/firebase_rules.txt)
//  - admin: ve y gestiona todo
//  - comercial / finanzas / contador / rrhh: tareas de su área + las propias/asignadas
//  - tecnico: solo tareas propias o asignadas (uidsAsociados)
(() => {
  /* ── Catálogos ───────────────────────────────────── */
  const AREAS = {
    comercial:      { label: "Comercial",      color: "#2563eb" },
    operativo:      { label: "Operativo",      color: "#1b7a51" },
    finanzas:       { label: "Finanzas",       color: "#b45309" },
    rrhh:           { label: "RR.HH.",         color: "#7c3aed" },
    administrativo: { label: "Administrativo", color: "#475569" }
  };
  const ESTADOS = {
    pendiente:   { label: "Pendiente",   color: "#94a3b8" },
    en_progreso: { label: "En progreso", color: "#2563eb" },
    en_revision: { label: "En revisión", color: "#d97706" },
    completada:  { label: "Completada",  color: "#1b7a51" },
    bloqueada:   { label: "Bloqueada",   color: "#dc2626" }
  };
  const PRIORIDADES = {
    baja:    { label: "Baja",    color: "#64748b" },
    media:   { label: "Media",   color: "#2563eb" },
    alta:    { label: "Alta",    color: "#d97706" },
    urgente: { label: "Urgente", color: "#dc2626" }
  };
  // Debe coincidir con areaDeRol() / veTarea() de las reglas
  const AREA_CREAR   = { comercial: "comercial", tecnico: "operativo", contador: "finanzas", finanzas: "finanzas", rrhh: "rrhh" };
  const AREA_LECTURA = { comercial: ["comercial"], contador: ["finanzas"], finanzas: ["finanzas"], rrhh: ["rrhh"] }; // tecnico: ninguna

  /* ── Refs ────────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);

  /* ── Estado ──────────────────────────────────────── */
  let _perfil = null;
  let _uid = null;
  let _tareas = new Map();
  let _usuarios = [];
  let _unsubs = [];
  let _vista = "lista";
  let _editId = null;
  let _checklist = [];
  let _charts = {};
  let _dragId = null;

  /* ── Helpers ─────────────────────────────────────── */
  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function toast(msg) {
    const el = $("t-toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2600);
  }
  function toDate(v) {
    if (!v) return null;
    try { return v.toDate ? v.toDate() : new Date(v); } catch { return null; }
  }
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function diasEntre(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }
  function fmt(d) { return d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) : "—"; }
  function inputToTs(v) {
    if (!v) return null;
    const [y, m, d] = v.split("-").map(Number);
    return firebase.firestore.Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
  }
  function dateToInput(d) {
    if (!d) return "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function role() { return _perfil?.role || "client"; }
  function esAdmin() { return role() === "admin"; }
  function nombreUsuario(u) {
    return [u.nombre, u.apellido].filter(Boolean).join(" ").trim() || u.email || "Usuario";
  }
  function miNombre() { return nombreUsuario(_perfil || {}) ; }
  function esVencida(t) {
    const v = toDate(t.fechaVencimiento);
    return !!v && t.estado !== "completada" && diasEntre(new Date(), v) < 0;
  }
  function esGestor(t) {
    return esAdmin() || t.creadoPor === _uid || (role() === "comercial" && t.area === "comercial");
  }
  function puedeEliminar(t) { return esAdmin() || t.creadoPor === _uid; }
  function badge(txt, color) {
    return `<span class="t-badge" style="background:${color}1a;color:${color}">${esc(txt)}</span>`;
  }
  function barra(pct, color) {
    return `<div class="t-bar"><i style="width:${pct}%;background:${color}"></i></div>`;
  }
  function plazo(t) {
    const v = toDate(t.fechaVencimiento);
    if (!v) return { txt: "Sin fecha", cls: "" };
    if (t.estado === "completada") return { txt: fmt(v), cls: "" };
    const d = diasEntre(new Date(), v);
    if (d < 0)  return { txt: `${fmt(v)} · vencida ${-d} d`, cls: "t-late" };
    if (d === 0) return { txt: "Vence hoy", cls: "t-warn" };
    if (d <= 3) return { txt: `${fmt(v)} · en ${d} d`, cls: "t-warn" };
    return { txt: fmt(v), cls: "" };
  }

  /* ── Suscripción a Firestore ─────────────────────── */
  // Las reglas no filtran: cada consulta debe coincidir con lo que la regla permite.
  function suscribir() {
    _unsubs.forEach((u) => u());
    _unsubs = [];
    const col = window.db.collection("tareas");
    const queries = [];
    if (esAdmin()) {
      queries.push(col);
    } else {
      queries.push(col.where("uidsAsociados", "array-contains", _uid));
      (AREA_LECTURA[role()] || []).forEach((a) => queries.push(col.where("area", "==", a)));
    }
    const partes = queries.map(() => new Map());
    queries.forEach((q, i) => {
      _unsubs.push(q.onSnapshot((snap) => {
        const m = new Map();
        snap.forEach((d) => m.set(d.id, { id: d.id, ...d.data() }));
        partes[i] = m;
        _tareas = new Map();
        partes.forEach((p) => p.forEach((v, k) => _tareas.set(k, v)));
        render();
      }, (err) => {
        console.error("[tareas]", err);
        $("pane-lista").innerHTML =
          `<div class="t-empty">No se pudieron cargar las tareas (${esc(err.code || "error")}). ` +
          `¿Publicaste las reglas nuevas de Firestore?</div>`;
      }));
    });
  }

  async function cargarUsuarios() {
    try {
      const snap = await window.db.collection("users").get();
      _usuarios = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((u) => u.activo !== false && u.role !== "client");
    } catch (e) {
      // Si falla, al menos permitir asignarse a uno mismo
      _usuarios = [{ uid: _uid, ..._perfil }];
    }
  }

  /* ── Filtros ─────────────────────────────────────── */
  function filtradas() {
    const q = $("f-buscar").value.trim().toLowerCase();
    const area = $("f-area").value;
    const estado = $("f-estado").value;
    const asg = $("f-asignado").value;
    const soloVenc = $("f-vencidas").checked;
    return [...(_tareas.values())].filter((t) => {
      if (area && t.area !== area) return false;
      if (estado && t.estado !== estado) return false;
      if (asg === "mias" && t.asignadoA !== _uid) return false;
      if (asg === "creadas" && t.creadoPor !== _uid) return false;
      if (soloVenc && !esVencida(t)) return false;
      if (q && !(`${t.titulo} ${t.asignadoNombre || ""} ${t.descripcion || ""}`.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => {
      const ca = a.estado === "completada" ? 1 : 0, cb = b.estado === "completada" ? 1 : 0;
      if (ca !== cb) return ca - cb;
      const da = toDate(a.fechaVencimiento)?.getTime() ?? Infinity;
      const db = toDate(b.fechaVencimiento)?.getTime() ?? Infinity;
      return da - db;
    });
  }

  /* ── Render ──────────────────────────────────────── */
  function render() {
    const lista = filtradas();
    renderKpis(lista);
    if (_vista === "lista") renderLista(lista);
    if (_vista === "tablero") renderTablero(lista);
    if (_vista === "cronograma") renderCronograma(lista);
    if (_vista === "graficos") renderGraficos(lista);
  }

  function renderKpis(lista) {
    const total = lista.length;
    const comp = lista.filter((t) => t.estado === "completada").length;
    const curso = lista.filter((t) => t.estado === "en_progreso" || t.estado === "en_revision").length;
    const venc = lista.filter(esVencida).length;
    const prom = total ? Math.round(lista.reduce((s, t) => s + (Number(t.avance) || 0), 0) / total) : 0;
    $("t-kpis").innerHTML = `
      <div class="t-kpi"><small>Tareas</small><b>${total}</b></div>
      <div class="t-kpi"><small>En curso</small><b>${curso}</b></div>
      <div class="t-kpi"><small>Completadas</small><b>${comp}</b></div>
      <div class="t-kpi ${venc ? "late" : ""}"><small>Vencidas</small><b>${venc}</b></div>
      <div class="t-kpi"><small>Avance promedio</small><b>${prom}%</b></div>`;
  }

  function renderLista(lista) {
    const pane = $("pane-lista");
    if (!lista.length) { pane.innerHTML = `<div class="t-empty">No hay tareas para mostrar.</div>`; return; }
    pane.innerHTML = `<div class="t-wrap"><table class="t-table">
      <thead><tr><th>Tarea</th><th>Responsable</th><th>Prioridad</th><th>Vencimiento</th><th>Estado</th><th style="min-width:140px">Avance</th></tr></thead>
      <tbody>${lista.map((t) => {
        const a = AREAS[t.area] || { label: t.area, color: "#475569" };
        const e = ESTADOS[t.estado] || ESTADOS.pendiente;
        const p = PRIORIDADES[t.prioridad] || PRIORIDADES.media;
        const pl = plazo(t);
        const av = Number(t.avance) || 0;
        return `<tr data-id="${esc(t.id)}">
          <td><div style="font-weight:600">${esc(t.titulo)}</div><div style="margin-top:3px">${badge(a.label, a.color)}</div></td>
          <td>${esc(t.asignadoNombre || "Sin asignar")}</td>
          <td>${badge(p.label, p.color)}</td>
          <td class="${pl.cls}">${esc(pl.txt)}</td>
          <td>${badge(e.label, e.color)}</td>
          <td>${barra(av, e.color)}<div style="font-size:.68rem;color:var(--gray);margin-top:2px">${av}%</div></td>
        </tr>`;
      }).join("")}</tbody></table></div>`;
  }

  function renderTablero(lista) {
    const pane = $("pane-tablero");
    pane.innerHTML = `<div class="t-board">${Object.entries(ESTADOS).map(([key, e]) => {
      const items = lista.filter((t) => t.estado === key);
      return `<div class="t-col" data-estado="${key}">
        <h4 style="color:${e.color}"><span>${esc(e.label)}</span><span>${items.length}</span></h4>
        ${items.map((t) => {
          const a = AREAS[t.area] || { label: t.area, color: "#475569" };
          const p = PRIORIDADES[t.prioridad] || PRIORIDADES.media;
          const pl = plazo(t);
          const av = Number(t.avance) || 0;
          return `<div class="t-card" draggable="true" data-id="${esc(t.id)}" style="border-left:4px solid ${a.color}">
            <div class="ttl">${esc(t.titulo)}</div>
            ${barra(av, e.color)}
            <div class="meta"><span class="${pl.cls}">${esc(pl.txt)}</span>${badge(p.label, p.color)}</div>
            <div class="meta"><span>${esc(t.asignadoNombre || "Sin asignar")}</span><span>${av}%</span></div>
          </div>`;
        }).join("")}
      </div>`;
    }).join("")}</div>`;
  }

  function renderCronograma(lista) {
    const pane = $("pane-cronograma");
    const conFechas = lista.map((t) => {
      const ini = toDate(t.fechaInicio) || toDate(t.fechaVencimiento);
      const fin = toDate(t.fechaVencimiento) || toDate(t.fechaInicio);
      return ini && fin ? { t, ini: startOfDay(ini), fin: startOfDay(fin < ini ? ini : fin) } : null;
    }).filter(Boolean);

    if (!conFechas.length) {
      pane.innerHTML = `<div class="t-empty">Ninguna tarea tiene fechas para mostrar en el cronograma.</div>`;
      return;
    }
    const hoy = startOfDay(new Date());
    let min = new Date(Math.min(...conFechas.map((x) => x.ini), hoy));
    let max = new Date(Math.max(...conFechas.map((x) => x.fin), hoy));
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 3);
    let span = Math.max(diasEntre(min, max) + 1, 21);
    const pct = (dias) => (dias / span) * 100;

    const paso = [1, 2, 7, 14, 30].find((p) => Math.ceil(span / p) <= 16) || 30;
    let ticks = "";
    for (let i = 0; i < span; i += paso) {
      const d = new Date(min); d.setDate(d.getDate() + i);
      ticks += `<div class="g-tick" style="left:${pct(i)}%">${fmt(d)}</div>`;
    }
    const hoyPct = pct(diasEntre(min, hoy) + 0.5);

    const filas = conFechas.sort((a, b) => a.ini - b.ini).map(({ t, ini, fin }) => {
      const a = AREAS[t.area] || { color: "#475569" };
      const left = pct(diasEntre(min, ini));
      const width = Math.max(pct(diasEntre(ini, fin) + 1), 1.2);
      const av = Number(t.avance) || 0;
      const venc = esVencida(t);
      return `<div class="g-row">
        <div class="g-label" data-id="${esc(t.id)}" title="${esc(t.titulo)}">${esc(t.titulo)}</div>
        <div class="g-track">
          <div class="g-bar" data-id="${esc(t.id)}"
               title="${esc(t.titulo)} — ${av}% (${fmt(ini)} → ${fmt(fin)})"
               style="left:${left}%;width:${width}%;background:${a.color}55;${venc ? "border-color:#dc2626;" : ""}">
            <i style="width:${av}%;background:${a.color}"></i><span>${av}%</span>
          </div>
        </div>
      </div>`;
    }).join("");

    pane.innerHTML = `<div class="g-wrap"><div class="g-grid">
      <div class="g-row g-head"><div class="g-label" style="cursor:default;font-weight:700">Tarea</div><div class="g-track">${ticks}</div></div>
      <div style="position:relative">
        ${filas}
        <div style="position:absolute;left:230px;right:0;top:0;bottom:0;pointer-events:none">
          <div class="g-today" style="left:${hoyPct}%" title="Hoy"></div>
        </div>
      </div>
    </div></div>
    <p class="text-xs mt-3" style="color:var(--gray)">
      Color = área · relleno oscuro = avance · borde rojo = vencida · línea roja = hoy.
    </p>`;
  }

  function destruirChart(k) { if (_charts[k]) { _charts[k].destroy(); delete _charts[k]; } }

  function renderGraficos(lista) {
    if (!window.Chart) return;
    // Estado
    destruirChart("estado");
    _charts.estado = new Chart($("ch-estado"), {
      type: "doughnut",
      data: {
        labels: Object.values(ESTADOS).map((e) => e.label),
        datasets: [{
          data: Object.keys(ESTADOS).map((k) => lista.filter((t) => t.estado === k).length),
          backgroundColor: Object.values(ESTADOS).map((e) => e.color)
        }]
      },
      options: { plugins: { legend: { position: "bottom" } } }
    });

    // Avance promedio por área
    const areasPres = Object.keys(AREAS).filter((k) => lista.some((t) => t.area === k));
    destruirChart("area");
    _charts.area = new Chart($("ch-area"), {
      type: "bar",
      data: {
        labels: areasPres.map((k) => AREAS[k].label),
        datasets: [{
          label: "Avance promedio (%)",
          data: areasPres.map((k) => {
            const xs = lista.filter((t) => t.area === k);
            return Math.round(xs.reduce((s, t) => s + (Number(t.avance) || 0), 0) / xs.length);
          }),
          backgroundColor: areasPres.map((k) => AREAS[k].color)
        }]
      },
      options: { scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }
    });

    // Carga por responsable (apilado por estado)
    const resp = [...new Set(lista.map((t) => t.asignadoNombre || "Sin asignar"))].slice(0, 12);
    destruirChart("resp");
    _charts.resp = new Chart($("ch-resp"), {
      type: "bar",
      data: {
        labels: resp,
        datasets: Object.entries(ESTADOS).map(([k, e]) => ({
          label: e.label,
          backgroundColor: e.color,
          data: resp.map((r) => lista.filter((t) => (t.asignadoNombre || "Sin asignar") === r && t.estado === k).length)
        }))
      },
      options: {
        indexAxis: "y",
        scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true } },
        plugins: { legend: { position: "bottom" } }
      }
    });
  }

  /* ── Modal ───────────────────────────────────────── */
  function llenarSelect(sel, obj, valor) {
    sel.innerHTML = Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("");
    if (valor) sel.value = valor;
  }

  function llenarAsignados(valor) {
    const sel = $("m-asignado");
    sel.innerHTML = `<option value="">— Sin asignar —</option>` + _usuarios.map((u) =>
      `<option value="${esc(u.uid)}">${esc(nombreUsuario(u))} (${esc(u.role || "")})</option>`).join("");
    sel.value = valor || "";
  }

  function llenarAreas(valor) {
    const sel = $("m-area");
    const permitidas = esAdmin() ? Object.keys(AREAS) : [AREA_CREAR[role()]].filter(Boolean);
    sel.innerHTML = permitidas.map((k) => `<option value="${k}">${esc(AREAS[k].label)}</option>`).join("");
    // Si la tarea tiene un área que el usuario no puede elegir (solo lectura), mostrarla igual
    if (valor && !permitidas.includes(valor)) {
      sel.innerHTML += `<option value="${esc(valor)}">${esc(AREAS[valor]?.label || valor)}</option>`;
    }
    sel.value = valor || permitidas[0] || "";
  }

  function pintarChecklist(soloLectura) {
    $("m-checklist").innerHTML = _checklist.map((c, i) => `
      <div class="chk-item">
        <input type="checkbox" data-chk="${i}" ${c.ok ? "checked" : ""}>
        <input type="text" class="f-input" data-chk-txt="${i}" value="${esc(c.t)}" maxlength="200" ${soloLectura ? "disabled" : ""}>
        <button type="button" data-chk-del="${i}" title="Quitar" ${soloLectura ? "disabled" : ""}><i class="fas fa-times"></i></button>
      </div>`).join("");
    recalcularAvanceAuto();
  }

  function recalcularAvanceAuto() {
    const auto = _checklist.length > 0;
    $("m-avance").disabled = auto || $("m-avance").dataset.bloqueado === "1";
    $("m-avance-auto").classList.toggle("hidden", !auto);
    if (auto) {
      const hechos = _checklist.filter((c) => c.ok).length;
      $("m-avance").value = Math.round((hechos / _checklist.length) * 100);
    }
    sincronizarEstadoConAvance();
  }

  function sincronizarEstadoConAvance() {
    const av = Number($("m-avance").value);
    $("m-avance-txt").textContent = `${av}%`;
    const est = $("m-estado");
    if (av === 100) est.value = "completada";
    else if (av > 0 && est.value === "pendiente") est.value = "en_progreso";
    else if (av < 100 && est.value === "completada") est.value = "en_progreso";
  }

  function abrirModal(id) {
    _editId = id || null;
    const t = id ? _tareas.get(id) : null;
    const gestor = !t || esGestor(t);

    $("m-titulo-modal").textContent = t ? "Detalle de tarea" : "Nueva tarea";
    llenarSelect($("m-prioridad"), PRIORIDADES, t?.prioridad || "media");
    llenarSelect($("m-estado"), ESTADOS, t?.estado || "pendiente");
    llenarAreas(t?.area || (esAdmin() ? "comercial" : AREA_CREAR[role()]));
    llenarAsignados(t ? (t.asignadoA || "") : _uid);

    $("m-titulo").value = t?.titulo || "";
    $("m-desc").value = t?.descripcion || "";
    $("m-inicio").value = t ? dateToInput(toDate(t.fechaInicio)) : dateToInput(new Date());
    $("m-fin").value = t ? dateToInput(toDate(t.fechaVencimiento)) : "";
    $("m-notas").value = t?.notas || "";
    $("m-avance").value = Number(t?.avance) || 0;
    _checklist = (t?.checklist || []).map((c) => ({ t: String(c.t || ""), ok: !!c.ok }));

    // Campos "de gestión": solo gestor; el resto puede actualizar avance
    ["m-titulo", "m-desc", "m-area", "m-prioridad", "m-asignado", "m-inicio", "m-fin"]
      .forEach((f) => { $(f).disabled = !gestor; });
    $("m-chk-nuevo").disabled = !gestor;
    $("m-chk-add").disabled = !gestor;
    $("m-avance").dataset.bloqueado = "0";
    $("m-aviso").classList.toggle("hidden", gestor);
    $("m-eliminar").classList.toggle("hidden", !(t && puedeEliminar(t)));

    pintarChecklist(!gestor);
    $("m-avance-txt").textContent = `${$("m-avance").value}%`;
    $("modal-tarea").classList.remove("hidden");
    if (gestor) $("m-titulo").focus();
  }

  function cerrarModal() {
    $("modal-tarea").classList.add("hidden");
    _editId = null;
  }

  async function guardar() {
    const prev = _editId ? _tareas.get(_editId) : null;
    const gestor = !prev || esGestor(prev);
    const btn = $("m-guardar");

    const estado = $("m-estado").value;
    const avance = estado === "completada" ? 100 : Number($("m-avance").value) || 0;
    const checklist = _checklist
      .map((c) => ({ t: c.t.trim().slice(0, 200), ok: !!c.ok }))
      .filter((c) => c.t);
    const notas = $("m-notas").value.trim().slice(0, 2000);
    const ts = firebase.firestore.FieldValue.serverTimestamp();
    const completadaEn = estado === "completada" ? (prev?.completadaEn || ts) : null;

    try {
      btn.disabled = true; btn.textContent = "Guardando…";

      // Responsable de la tarea (no gestor): solo campos de avance
      if (prev && !gestor) {
        await window.db.collection("tareas").doc(_editId).update({
          estado, avance, checklist, notas, completadaEn, updatedAt: ts
        });
        toast("Avance actualizado");
        cerrarModal();
        return;
      }

      const titulo = $("m-titulo").value.trim();
      if (!titulo) { toast("El título es obligatorio"); return; }
      const ini = inputToTs($("m-inicio").value);
      const fin = inputToTs($("m-fin").value);
      if (ini && fin && fin.toMillis() < ini.toMillis()) {
        toast("El vencimiento no puede ser anterior al inicio"); return;
      }
      const asignadoA = $("m-asignado").value || null;
      const asignado = _usuarios.find((u) => u.uid === asignadoA);
      const creadoPor = prev ? prev.creadoPor : _uid;
      const uidsAsociados = [...new Set([creadoPor, asignadoA].filter(Boolean))];

      const data = {
        titulo,
        descripcion: $("m-desc").value.trim().slice(0, 2000),
        area: $("m-area").value,
        prioridad: $("m-prioridad").value,
        estado, avance, checklist, notas, completadaEn,
        fechaInicio: ini, fechaVencimiento: fin,
        asignadoA,
        asignadoNombre: asignado ? nombreUsuario(asignado) : "",
        uidsAsociados,
        updatedAt: ts
      };

      if (prev) {
        await window.db.collection("tareas").doc(_editId).update(data);
        toast("Tarea actualizada");
      } else {
        await window.db.collection("tareas").add({
          ...data,
          creadoPor: _uid,
          creadoPorNombre: miNombre(),
          createdAt: ts
        });
        toast("Tarea creada");
      }
      cerrarModal();
    } catch (e) {
      console.error("[tareas] guardar", e);
      toast(e.code === "permission-denied" ? "Sin permiso para esta acción" : "Error al guardar");
    } finally {
      btn.disabled = false; btn.textContent = "Guardar";
    }
  }

  async function eliminar() {
    if (!_editId) return;
    if (!confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")) return;
    try {
      await window.db.collection("tareas").doc(_editId).delete();
      toast("Tarea eliminada");
      cerrarModal();
    } catch (e) {
      toast(e.code === "permission-denied" ? "Sin permiso para eliminar" : "Error al eliminar");
    }
  }

  // Cambio de estado desde el tablero (arrastrar y soltar)
  async function moverEstado(id, estado) {
    const t = _tareas.get(id);
    if (!t || t.estado === estado) return;
    let avance = Number(t.avance) || 0;
    if (estado === "completada") avance = 100;
    else if (t.estado === "completada" && avance === 100) avance = 90;
    try {
      await window.db.collection("tareas").doc(id).update({
        estado, avance,
        completadaEn: estado === "completada" ? firebase.firestore.FieldValue.serverTimestamp() : null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      toast("Sin permiso para mover esta tarea");
    }
  }

  /* ── Eventos ─────────────────────────────────────── */
  function cambiarVista(v) {
    _vista = v;
    document.querySelectorAll(".t-tab").forEach((b) => b.classList.toggle("active", b.dataset.vista === v));
    document.querySelectorAll(".t-pane").forEach((p) => p.classList.toggle("active", p.id === `pane-${v}`));
    render();
  }

  function bind() {
    document.querySelectorAll(".t-tab").forEach((b) => b.addEventListener("click", () => cambiarVista(b.dataset.vista)));
    ["f-buscar", "f-area", "f-estado", "f-asignado", "f-vencidas"].forEach((id) =>
      $(id).addEventListener(id === "f-buscar" ? "input" : "change", render));

    $("btn-nueva").addEventListener("click", () => abrirModal(null));
    $("m-cerrar").addEventListener("click", cerrarModal);
    $("m-cancelar").addEventListener("click", cerrarModal);
    $("m-guardar").addEventListener("click", guardar);
    $("m-eliminar").addEventListener("click", eliminar);
    $("modal-tarea").addEventListener("mousedown", (e) => { if (e.target.id === "modal-tarea") cerrarModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarModal(); });

    // Abrir detalle desde lista / tablero / cronograma
    ["pane-lista", "pane-tablero", "pane-cronograma"].forEach((pid) => {
      $(pid).addEventListener("click", (e) => {
        const el = e.target.closest("[data-id]");
        if (el) abrirModal(el.dataset.id);
      });
    });

    // Drag & drop del tablero
    const tablero = $("pane-tablero");
    tablero.addEventListener("dragstart", (e) => {
      const c = e.target.closest(".t-card");
      if (!c) return;
      _dragId = c.dataset.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", _dragId);
    });
    tablero.addEventListener("dragover", (e) => {
      const col = e.target.closest(".t-col");
      if (!col) return;
      e.preventDefault();
      tablero.querySelectorAll(".t-col.over").forEach((c) => c.classList.remove("over"));
      col.classList.add("over");
    });
    tablero.addEventListener("dragleave", (e) => {
      if (!e.relatedTarget || !e.relatedTarget.closest?.(".t-col")) {
        tablero.querySelectorAll(".t-col.over").forEach((c) => c.classList.remove("over"));
      }
    });
    tablero.addEventListener("drop", (e) => {
      const col = e.target.closest(".t-col");
      tablero.querySelectorAll(".t-col.over").forEach((c) => c.classList.remove("over"));
      if (!col || !_dragId) return;
      e.preventDefault();
      moverEstado(_dragId, col.dataset.estado);
      _dragId = null;
    });

    // Checklist
    const addChk = () => {
      const inp = $("m-chk-nuevo");
      const txt = inp.value.trim();
      if (!txt || _checklist.length >= 50) return;
      _checklist.push({ t: txt.slice(0, 200), ok: false });
      inp.value = "";
      pintarChecklist(false);
    };
    $("m-chk-add").addEventListener("click", addChk);
    $("m-chk-nuevo").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addChk(); } });
    $("m-checklist").addEventListener("change", (e) => {
      const i = e.target.dataset.chk;
      if (i !== undefined) { _checklist[i].ok = e.target.checked; recalcularAvanceAuto(); }
    });
    $("m-checklist").addEventListener("input", (e) => {
      const i = e.target.dataset.chkTxt;
      if (i !== undefined) _checklist[i].t = e.target.value;
    });
    $("m-checklist").addEventListener("click", (e) => {
      const b = e.target.closest("[data-chk-del]");
      if (!b) return;
      _checklist.splice(Number(b.dataset.chkDel), 1);
      pintarChecklist(false);
    });

    $("m-avance").addEventListener("input", sincronizarEstadoConAvance);
    $("m-estado").addEventListener("change", () => {
      if ($("m-estado").value === "completada") {
        $("m-avance").value = 100;
        $("m-avance-txt").textContent = "100%";
      }
    });
  }

  /* ── Init ────────────────────────────────────────── */
  function prepararFiltros() {
    const areas = esAdmin()
      ? Object.keys(AREAS)
      : [...new Set([AREA_CREAR[role()], ...(AREA_LECTURA[role()] || [])].filter(Boolean))];
    $("f-area").innerHTML = `<option value="">Todas las áreas</option>` +
      areas.map((k) => `<option value="${k}">${esc(AREAS[k].label)}</option>`).join("");
    $("f-estado").innerHTML = `<option value="">Todos los estados</option>` +
      Object.entries(ESTADOS).map(([k, e]) => `<option value="${k}">${esc(e.label)}</option>`).join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    Promise.resolve(window.__domkaFirebaseReady).then(() => {
      if (!window.auth || !window.db) return;
      window.auth.onAuthStateChanged(async (u) => {
        const emailEl = $("user-email");
        if (emailEl) emailEl.textContent = u?.email || "Usuario";
        if (!u) return;

        _uid = u.uid;
        _perfil = typeof window.cargarPerfil === "function"
          ? await window.cargarPerfil(u).catch(() => null)
          : null;
        if (!_perfil || _perfil.role === "client") return; // auth.js ya redirige a clientes

        if (typeof window.aplicarRestriccionesUI === "function") window.aplicarRestriccionesUI(_perfil);

        const sub = esAdmin()
          ? "Vista global: todas las áreas"
          : role() === "tecnico"
            ? "Tus tareas propias y asignadas"
            : `Tareas del área ${AREAS[AREA_CREAR[role()]]?.label || ""} y las asignadas a ti`;
        $("t-subtitulo").textContent = sub;

        prepararFiltros();
        $("btn-nueva").classList.remove("hidden");
        await cargarUsuarios();
        suscribir();
      });
    }).catch(() => {});
  });
})();
