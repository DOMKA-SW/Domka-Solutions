// js/proyectos.js — v4.0 DOMKA

(() => {
  /* ── Refs ────────────────────────────────────────── */
  const tbody          = document.getElementById("tabla-proyectos");
  const empty          = document.getElementById("empty-proyectos");
  const formProyecto   = document.getElementById("form-proyecto");
  const clienteSelect  = document.getElementById("proy-cliente");
  const tecnicoSelect  = document.getElementById("proy-tecnico");   // ahora es <select>
  const estadoSelect   = document.getElementById("proy-estado");
  const descripcionInput = document.getElementById("proy-descripcion");
  const nombreInput    = document.getElementById("proy-nombre");
  const fechaInicioInput = document.getElementById("proy-fecha-inicio");
  const fechaFinInput  = document.getElementById("proy-fecha-fin");
  const cotizacionSelect = document.getElementById("proy-cotizacion");
  const searchInput    = document.getElementById("proy-search");

  /* ── Modal detalle ───────────────────────────────── */
  const modal    = document.getElementById("modal-detalle");
  const inputEvid = document.getElementById("evidencia-input");
  const inputLink = document.getElementById("evidencia-link");
  const btnSubir  = document.getElementById("btn-subir-ev");

  /* ── Estado ──────────────────────────────────────── */
  let _all      = [];     // lista ligera (sin base64 de evidencias)
  let _filtro   = "todos";
  let _busqueda = "";
  let _current  = null;   // proyecto abierto en modal (con base64 cargado)
  let _perfil   = null;
  let _usuarios = [];     // usuarios internos del sistema

  /* ── Helpers ─────────────────────────────────────── */
  function esc(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function fmtDate(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
      return d ? d.toLocaleDateString("es-CO") : "—";
    } catch { return "—"; }
  }

  function semanaLabel(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : new Date());
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const lun = new Date(new Date(d).setDate(diff));
      return `Semana del ${lun.toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"})}`;
    } catch { return "Sin fecha"; }
  }

  function fmtMoney(n, moneda) {
    if (!n) return "—";
    const fmt = new Intl.NumberFormat("es-CO", { style:"currency", currency: moneda || "COP", minimumFractionDigits:0 });
    return fmt.format(Number(n));
  }

  function badge(estado) {
    const map = {
      pendiente:    { t:"Pendiente",    c:"bg-yellow-100 text-yellow-800" },
      en_ejecucion: { t:"En ejecución", c:"bg-blue-100 text-blue-800" },
      finalizado:   { t:"Finalizado",   c:"bg-green-100 text-green-800" },
      suspendido:   { t:"Suspendido",   c:"bg-red-100 text-red-800" }
    };
    const v = map[estado] || map.pendiente;
    return `<span class="text-xs font-semibold px-2 py-1 rounded-full ${v.c}">${v.t}</span>`;
  }

  function tipoIcon(ev) {
    const ct   = (ev.contentType || ev.tipo || "").toLowerCase();
    const name = (ev.name || ev.nombre || "").toLowerCase();
    if (ct.startsWith("image/")) return "🖼️";
    if (ct.startsWith("video/")) return "🎬";
    if (ct === "application/pdf" || name.endsWith(".pdf")) return "📄";
    if (name.endsWith(".zip") || name.endsWith(".rar")) return "🗜️";
    if (ev.tipo === "link") return "🔗";
    return "📎";
  }

  function tipoIconDoc(d) {
    const ct = (d.contentType || "").toLowerCase();
    if (ct.startsWith("image/")) return "🖼️";
    if (ct === "application/pdf") return "📄";
    if (ct.includes("word")) return "📝";
    if (ct.includes("excel") || ct.includes("spreadsheet")) return "📊";
    return "📎";
  }

  /* ── Filtros + búsqueda ──────────────────────────── */
  function aplicarFiltro() {
    let list = _filtro === "todos" ? _all : _all.filter(p => (p.estado || "pendiente") === _filtro);
    if (_busqueda) {
      const q = _busqueda.toLowerCase();
      list = list.filter(p =>
        (p.nombre || "").toLowerCase().includes(q) ||
        (p.numero || "").toLowerCase().includes(q) ||
        (p.nombreCliente || p.clienteNombre || "").toLowerCase().includes(q) ||
        (p.tecnico || "").toLowerCase().includes(q) ||
        (p.descripcion || "").toLowerCase().includes(q)
      );
    }
    render(list);
  }

  document.querySelectorAll("[data-filtro]").forEach(btn => {
    btn.addEventListener("click", () => {
      _filtro = btn.getAttribute("data-filtro");
      document.querySelectorAll("[data-filtro]").forEach(b =>
        b.classList.toggle("active", b.getAttribute("data-filtro") === _filtro));
      aplicarFiltro();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      _busqueda = searchInput.value.trim();
      aplicarFiltro();
    });
  }

  /* ── Tabla principal ─────────────────────────────── */
  function render(list) {
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400">
        ${_busqueda ? "Sin resultados para «" + esc(_busqueda) + "»" : "Sin proyectos aún."}
      </td></tr>`;
      if (empty) empty.style.display = "none";
      return;
    }
    if (empty) empty.style.display = "none";

    tbody.innerHTML = list.map((p, idx) => {
      const evCount  = (p.evidencias || []).length;
      const docCount = (p.documentos || []).length;
      const usrCount = (p.usuariosAsociados || []).length;
      const empresa  = p.empresaNombre || "";
      return `
        <tr class="border-b hover:bg-gray-50 cursor-pointer" onclick="verDetalle('${p.id}')">
          <td class="p-3 text-gray-400 text-xs">${String(idx + 1).padStart(2,"0")}</td>
          <td class="p-3">
            <div class="font-medium text-sm">${esc(p.numero || p.id.slice(0,8).toUpperCase())}</div>
            <div class="text-xs text-gray-500">${esc(p.nombre || "")}</div>
          </td>
          <td class="p-3 text-sm">
            <div>${esc(p.nombreCliente || p.clienteNombre || "—")}</div>
            ${empresa ? `<div class="text-xs text-gray-400">${esc(empresa)}</div>` : ""}
          </td>
          <td class="p-3 text-sm">${esc(p.tecnico || "—")}</td>
          <td class="p-3">${badge(p.estado || "pendiente")}</td>
          <td class="p-3 text-xs text-gray-500 space-x-1">
            ${evCount  ? `<span title="Evidencias">📷 ${evCount}</span>` : ""}
            ${docCount ? `<span title="Documentos">📄 ${docCount}</span>` : ""}
            ${usrCount ? `<span title="Usuarios asignados">👥 ${usrCount}</span>` : ""}
            ${(!evCount && !docCount && !usrCount) ? "—" : ""}
          </td>
          <td class="p-3 text-xs text-gray-400">${fmtDate(p.creadoEn || p.createdAt)}</td>
        </tr>`;
    }).join("");
  }

  /* ── Cargar proyectos (con límite) ───────────────── */
  async function cargar() {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400">Cargando…</td></tr>`;
    try {
      let query = db.collection("proyectos");
      if (_perfil?.role === "client") {
        if (_perfil?.empresaId)   query = query.where("empresaId", "==", _perfil.empresaId);
        else if (_perfil?.clienteId) query = query.where("clienteId", "==", _perfil.clienteId);
      }
      // Límite de 100 para evitar leer toda la colección en una sola llamada
      const snap = await query.orderBy("creadoEn", "desc").limit(100).get();
      _all = snap.docs.map(d => {
        const data = d.data() || {};
        // Guardamos lista ligera: quitamos base64 pesado de evidencias/documentos
        // El base64 completo se recarga al abrir el modal (verDetalle)
        return {
          id: d.id,
          numero: data.numero,
          nombre: data.nombre,
          clienteId: data.clienteId,
          nombreCliente: data.nombreCliente || data.clienteNombre,
          empresaId: data.empresaId,
          empresaNombre: data.empresaNombre,
          tecnico: data.tecnico,
          estado: data.estado,
          descripcion: data.descripcion,
          fechaInicio: data.fechaInicio,
          fechaCierre: data.fechaCierre,
          presupuesto: data.presupuesto,
          moneda: data.moneda,
          creadoEn: data.creadoEn,
          createdAt: data.createdAt,
          creadoPor: data.creadoPor,
          usuariosAsociados: data.usuariosAsociados || [],
          aprobadores: data.aprobadores || [],
          // Solo conteo de archivos para la tabla, sin base64
          evidencias: (data.evidencias || []).map(ev => ({
            tipo: ev.tipo, contentType: ev.contentType, name: ev.name,
            nombre: ev.nombre, url: ev.url, uploadedAt: ev.uploadedAt
          })),
          documentos: (data.documentos || []).map(doc => ({
            tipo: doc.tipo, nombre: doc.nombre, estado: doc.estado,
            url: doc.url, creadoEn: doc.creadoEn
          }))
        };
      });
      aplicarFiltro();
    } catch (e) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500">Error cargando proyectos. Verifica tu conexión.</td></tr>`;
    }
  }

  /* ── Cargar usuarios del sistema ─────────────────── */
  async function cargarUsuariosSistema() {
    try {
      const snap = await db.collection("users").get();
      _usuarios = snap.docs
        .map(d => ({
          uid:    d.id,
          email:  d.data().email || d.data().correo || d.id,
          nombre: d.data().nombre || d.data().displayName || d.data().email || d.id,
          role:   d.data().role || "—"
        }))
        .filter(u => u.role !== "client"); // solo usuarios internos

      renderUsuariosPicker();
      renderTecnicoSelect();
    } catch (_) { /* sin acceso a users — no bloquear */ }
  }

  function renderTecnicoSelect() {
    if (!tecnicoSelect) return;
    const current = tecnicoSelect.value;
    tecnicoSelect.innerHTML = `<option value="">— Sin asignar —</option>`;
    _usuarios.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.nombre || u.email;
      opt.textContent = `${u.nombre} (${u.role})`;
      if (opt.value === current) opt.selected = true;
      tecnicoSelect.appendChild(opt);
    });
  }

  function renderUsuariosPicker() {
    const wrapU = document.getElementById("proy-usuarios-wrap");
    const wrapA = document.getElementById("proy-aprobadores-wrap");
    if (!wrapU) return;

    if (!_usuarios.length) {
      wrapU.innerHTML = `<p class="text-gray-400 text-xs italic px-1">Sin usuarios disponibles</p>`;
      return;
    }

    wrapU.innerHTML = _usuarios.map(u => `
      <label class="flex items-center gap-2 px-1 py-1 hover:bg-green-50 rounded cursor-pointer">
        <input type="checkbox" class="proy-user-chk accent-green-700" value="${esc(u.uid)}"
          data-email="${esc(u.email)}" data-nombre="${esc(u.nombre)}"
          onchange="sincronizarAprobadores()">
        <span class="text-xs"><b>${esc(u.nombre)}</b> <span class="text-gray-400">${esc(u.email)}</span></span>
        <span class="ml-auto text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">${esc(u.role)}</span>
      </label>`).join("");

    if (wrapA) wrapA.innerHTML = `<p class="text-gray-400 text-xs italic px-1">Primero selecciona usuarios asociados</p>`;
  }

  window.sincronizarAprobadores = function() {
    const wrapA = document.getElementById("proy-aprobadores-wrap");
    if (!wrapA) return;
    const sel = Array.from(document.querySelectorAll(".proy-user-chk:checked"));
    if (!sel.length) {
      wrapA.innerHTML = `<p class="text-gray-400 text-xs italic px-1">Primero selecciona usuarios asociados</p>`;
      return;
    }
    wrapA.innerHTML = sel.map(chk => `
      <label class="flex items-center gap-2 px-1 py-1 hover:bg-green-50 rounded cursor-pointer">
        <input type="checkbox" class="proy-apro-chk accent-green-700" value="${esc(chk.value)}"
          data-email="${esc(chk.dataset.email)}" data-nombre="${esc(chk.dataset.nombre)}">
        <span class="text-xs"><b>${esc(chk.dataset.nombre)}</b> <span class="text-gray-400">${esc(chk.dataset.email)}</span></span>
        <span class="ml-auto text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">✓ Aprobador</span>
      </label>`).join("");
  };

  function getSelectedUsers() {
    const asociados = Array.from(document.querySelectorAll(".proy-user-chk:checked")).map(c => ({
      uid: c.value, email: c.dataset.email, nombre: c.dataset.nombre
    }));
    const aprobadores = Array.from(document.querySelectorAll(".proy-apro-chk:checked")).map(c => ({
      uid: c.value, email: c.dataset.email, nombre: c.dataset.nombre
    }));
    return { asociados, aprobadores };
  }

/* ── Clientes para el form ───────────────────────── */
async function cargarClientesForm() {
  if (!clienteSelect) return;
  clienteSelect.innerHTML =
    `<option value="">Selecciona cliente</option>`;
  const snap = await db
    .collection("clientes")
    .orderBy("nombre")
    .get()
    .catch(() => db.collection("clientes").get());
  snap.forEach(doc => {
    const c = doc.data() || {};
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent =
      c.nombre ||
      c.empresa ||
      c.email ||
      doc.id;

    opt.dataset.empresa =
      c.empresa || "";
    clienteSelect.appendChild(opt);
  });
}

/* ── Cargar Cotizaciones del Cliente ───────────────── */
async function cargarCotizacionesCliente(clienteId) {
  if (!cotizacionSelect) return;
  cotizacionSelect.innerHTML = `
    <option value="">
      Selecciona una cotización
    </option>
  `;
  if (!clienteId) return;
  try {
    const snap = await db
      .collection("cotizaciones")
      .where("clienteId", "==", clienteId)
      .get();
    snap.forEach(doc => {
      const c = doc.data() || {};
      const option =
        document.createElement("option");
      option.value = doc.id;
      option.dataset.total =
        c.total || 0;
      option.dataset.estado =
        c.estado || "pendiente";
      option.dataset.planPagos =
        JSON.stringify(c.planPagos || []);
      option.dataset.anexos =
        JSON.stringify(c.anexos || []);
      option.textContent =
        `${(c.total || 0).toLocaleString("es-CO")} COP - ${c.estado || "pendiente"}`;
      cotizacionSelect.appendChild(option);
    });
  } catch (error) {
    console.error(
      "Error cargando cotizaciones:",
      error
    );
  }
}

/* ── Cambio de cliente ─────────────────────────────── */
clienteSelect?.addEventListener("change", (e) => {
  const clienteId = e.target.value;
  cargarCotizacionesCliente(clienteId);
});
  
  /* ── Crear proyecto ──────────────────────────────── */
  async function crearProyecto(e) {
    e.preventDefault();
    if (!_perfil) return;
    if (!["admin","comercial","tecnico"].includes(_perfil.role)) {
      alert("Tu rol no tiene permiso para crear proyectos."); return;
    }
    const clienteId = (clienteSelect?.value || "").trim();
    if (!clienteId) { alert("Selecciona un cliente."); return; }

    const clienteDoc  = await db.collection("clientes").doc(clienteId).get();
    const clienteData = clienteDoc.data() || {};
    const numero      = `PRY-${Date.now().toString().slice(-6)}`;
    const { asociados, aprobadores } = getSelectedUsers();

    const cotizacionId =
    cotizacionSelect?.value || null;
     let cotizacionData = null;
     if(cotizacionId){
    const cotizacionDoc =
        await db.collection("cotizaciones")
        .doc(cotizacionId)
        .get();
    cotizacionData =
        cotizacionDoc.data() || null;
    }
    
    const payload = {
      numero,
      nombre:           (nombreInput?.value || "").trim(),
      clienteId,
      empresaId:        clienteData.empresaId || null,
      empresaNombre:    clienteData.empresa   || null,
      nombreCliente:    clienteData.nombre    || clienteData.empresa || "Cliente",
      tecnico:          (tecnicoSelect?.value || tecnicoSelect?.querySelector?.("option:checked")?.value || "").trim(),
      estado:           (estadoSelect?.value  || "pendiente").trim(),
      descripcion:      (descripcionInput?.value || "").trim(),
      fechaInicio:      fechaInicioInput?.value  || null,
      fechaCierre:      fechaFinInput?.value      || null,
      cotizacionId,
      presupuesto:      cotizacionData?.total || null,
      totalCotizado:    cotizacionData?.total || null,
      planPagos:        cotizacionData?.planPagos || [],
      cotizacionEstado: cotizacionData?.estado || null,
      usuariosAsociados: asociados,
      aprobadores:      aprobadores,
      evidencias:       [],
      documentos:      (cotizacionData?.anexos || []) .map(a => ({tipo: "anexo-cotizacion", nombre: a.nombre, base64: a.base64, contentType: a.tipo, estado: "aprobado",creadoEn: new Date().toISOString() })),
      creadoPor:        window.auth?.currentUser?.uid || null,
      creadoEn:         firebase.firestore.FieldValue.serverTimestamp()
    };

    const btn = formProyecto.querySelector("button[type=submit]");
    if (btn) { btn.disabled = true; btn.textContent = "Creando…"; }
    try {
      await db.collection("proyectos").add(payload);
      formProyecto.reset();
      renderUsuariosPicker();
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-plus mr-1"></i> Crear`; }
    }
    await cargar();
  }

  /* ── Modal detalle ───────────────────────────────── */
  // Al abrir el modal recargamos el doc completo desde Firestore
  // para tener base64 de evidencias/documentos siempre frescos
  async function verDetalle(id) {
    try {
      const snap = await db.collection("proyectos").doc(id).get();
      if (!snap.exists) return;
      _current = { id, ...snap.data() };
      llenarDetalle(_current);
      if (modal) modal.classList.remove("hidden");
    } catch (_) {
      alert("No se pudo cargar el detalle del proyecto.");
    }
  }

  function cerrarDetalle() {
    if (modal) modal.classList.add("hidden");
    _current = null;
    if (inputEvid) inputEvid.value = "";
    if (inputLink) inputLink.value = "";
  }

  function llenarDetalle(p) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("detalle-numero",      p.numero || p.id.slice(0,8).toUpperCase());
    set("detalle-nombre",      p.nombre || "");
    set("detalle-cliente",     p.nombreCliente || p.clienteNombre || "—");
    set("detalle-tecnico",     p.tecnico || "—");
    set("detalle-descripcion", p.descripcion || "—");

    const estadoWrap = document.querySelector("#detalle-estado-wrap > div");
    if (estadoWrap) estadoWrap.innerHTML = badge(p.estado || "pendiente");

    const fInicio = document.getElementById("detalle-fecha-inicio");
    const fCierre = document.getElementById("detalle-fecha-cierre");
    if (fInicio) fInicio.textContent = fmtDate(p.fechaInicio) || "—";
    if (fCierre) fCierre.textContent = fmtDate(p.fechaCierre) || "—";

    // Presupuesto (nuevo)
    const presEl = document.getElementById("detalle-presupuesto");
    if (presEl) presEl.textContent = p.presupuesto ? fmtMoney(p.presupuesto, p.moneda) : "—";

    // Usuarios asociados y aprobadores
    const usersEl = document.getElementById("detalle-usuarios");
    if (usersEl) {
      const asoc = p.usuariosAsociados || [];
      const apro = p.aprobadores || [];
      if (!asoc.length && !apro.length) {
        usersEl.innerHTML = `<p class="text-gray-400 text-xs">Sin usuarios asignados.</p>`;
      } else {
        usersEl.innerHTML = `
          ${asoc.length ? `
            <p class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">👥 Asociados</p>
            <div class="flex flex-wrap gap-1 mb-2">
              ${asoc.map(u => `<span class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">${esc(u.nombre || u.email)}</span>`).join("")}
            </div>` : ""}
          ${apro.length ? `
            <p class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">✅ Aprobadores</p>
            <div class="flex flex-wrap gap-1">
              ${apro.map(u => `<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">⭐ ${esc(u.nombre || u.email)}</span>`).join("")}
            </div>` : ""}`;
      }
    }

    // Documentos
    const docsEl = document.getElementById("detalle-documentos");
    if (docsEl) {
      const docs = p.documentos || [];
      if (!docs.length) {
        docsEl.innerHTML = `<p class="text-gray-400 text-sm">Sin documentos.</p>`;
      } else {
        const tiposOrden = ["Acta de Inicio","Contrato","Acta de Cierre","Informe","Otro"];
        const agrupados = {};
        docs.forEach(d => { const t = d.tipo || "Otro"; if (!agrupados[t]) agrupados[t] = []; agrupados[t].push(d); });
        docsEl.innerHTML = tiposOrden
          .filter(t => agrupados[t])
          .concat(Object.keys(agrupados).filter(t => !tiposOrden.includes(t)))
          .map(tipo => `
            <div class="mb-3">
              <p class="text-xs font-bold uppercase tracking-wider text-green-700 mb-1">${esc(tipo)}</p>
              ${agrupados[tipo].map(d => `
                <div class="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                  <span class="text-sm">${d.base64 ? tipoIconDoc(d) : "📄"}</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">${esc(d.nombre || d.tipo)}</div>
                    <div class="text-xs text-gray-400">${fmtDate(d.creadoEn)} · ${d.estado === "aprobado" ? "✅ Aprobado" : d.estado === "rechazado" ? "❌ Rechazado" : "⏳ Pendiente"}</div>
                  </div>
                  <div class="flex gap-2 items-center">
                    ${d.base64 ? `<a href="${esc(d.base64)}" download="${esc(d.fileName || d.nombre)}" class="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100">⬇ Descargar</a>` : ""}
                    ${d.url ? `<a href="${esc(d.url)}" target="_blank" class="text-xs text-green-700 underline whitespace-nowrap">🔗 Ver link</a>` : ""}
                    ${canApprove(p) && d.estado !== "aprobado" ? `<button onclick="aprobarDoc('${p.id}','${esc(d.nombre || d.tipo)}')" class="text-xs bg-green-700 text-white px-2 py-1 rounded hover:bg-green-800">Aprobar</button>` : ""}
                  </div>
                </div>`).join("")}
            </div>`).join("");
      }
    }

    // Evidencias agrupadas por semana
    const galeria = document.getElementById("galeria-evidencias");
    if (!galeria) return;
    const evs = (p.evidencias || []).slice().reverse();
    if (!evs.length) { galeria.innerHTML = `<p class="text-gray-400 text-sm">Sin evidencias.</p>`; return; }

    const semanas = {};
    evs.forEach(ev => {
      const sk = semanaLabel(ev.uploadedAt || ev.fecha);
      if (!semanas[sk]) semanas[sk] = [];
      semanas[sk].push(ev);
    });

    galeria.innerHTML = Object.entries(semanas).map(([sem, items]) => `
      <div class="mb-5">
        <p class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">${esc(sem)}</p>
        <div class="evidence-grid">
          ${items.map(ev => {
            const isImg  = (ev.contentType || ev.tipo || "").startsWith("image/");
            const isVid  = (ev.contentType || ev.tipo || "").startsWith("video/");
            const isLink = ev.tipo === "link";
            const label  = esc(ev.name || ev.nombre || ev.url || "Archivo");
            const icon   = tipoIcon(ev);
            if (isLink) return `
              <a href="${esc(ev.url)}" target="_blank"
                 class="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-green-50 hover:border-green-300 text-sm transition col-span-full">
                ${icon} <span class="truncate text-blue-700 underline">${label}</span>
              </a>`;
            if (isImg && ev.base64) return `
              <div class="relative group cursor-pointer" onclick="abrirLightbox('${ev.base64}')">
                <img class="evidence-thumb rounded-lg w-full h-24 object-cover" src="${ev.base64}" alt="${label}">
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition"></div>
              </div>`;
            if (isVid && ev.base64) return `
              <video class="evidence-thumb rounded-lg w-full h-24 object-cover" controls>
                <source src="${ev.base64}" type="${esc(ev.contentType)}">
              </video>`;
            if (ev.base64) return `
              <a href="${ev.base64}" download="${label}"
                 class="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-green-50 hover:border-green-300 text-sm transition">
                ${icon} <span class="truncate">${label}</span>
              </a>`;
            return "";
          }).join("")}
        </div>
      </div>`).join("");
  }

  function canApprove(p) {
    const uid = window.auth?.currentUser?.uid;
    if (!uid) return false;
    if (_perfil?.role === "admin") return true;
    return (p.aprobadores || []).some(a => a.uid === uid);
  }

  window.aprobarDoc = async function(proyId, docNombre) {
    if (!confirm(`¿Aprobar el documento "${docNombre}"?`)) return;
    const snap = await db.collection("proyectos").doc(proyId).get();
    const data = snap.data() || {};
    const docs = (data.documentos || []).map(d =>
      (d.nombre === docNombre || d.tipo === docNombre)
        ? { ...d, estado: "aprobado", aprobadoPor: window.auth?.currentUser?.uid, aprobadoEn: new Date().toISOString() }
        : d
    );
    await db.collection("proyectos").doc(proyId).update({ documentos: docs });
    _current = { ..._current, documentos: docs };
    llenarDetalle(_current);
    _all = _all.map(p => p.id === proyId ? { ...p, documentos: docs } : p);
  };

  /* ── Lightbox ────────────────────────────────────── */
  function abrirLightbox(src) {
    const lb  = document.getElementById("lightbox");
    const img = document.getElementById("lightbox-img");
    if (!lb || !img) return;
    img.src = src;
    lb.classList.remove("hidden");
  }

  function cerrarLightbox() {
    const lb  = document.getElementById("lightbox");
    const img = document.getElementById("lightbox-img");
    if (img) img.src = "";
    if (lb)  lb.classList.add("hidden");
  }

  /* ── Subir evidencias ────────────────────────────── */
  async function subirEvidencia() {
    if (!_current) return;
    const files = Array.from(inputEvid?.files || []);
    const link  = (inputLink?.value || "").trim();

    if (!files.length && !link) { alert("Selecciona archivos o ingresa un link."); return; }

    if (btnSubir) { btnSubir.disabled = true; btnSubir.textContent = "Subiendo…"; }

    try {
      const uploads = [];

      for (const f of files) {
        if (f.size > 5 * 1024 * 1024) throw new Error(`${f.name} supera 5 MB.`);
        const base64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(f);
        });
        uploads.push({ name: f.name, contentType: f.type, size: f.size, base64, uploadedAt: new Date().toISOString() });
      }

      if (link) uploads.push({ tipo: "link", url: link, name: link, uploadedAt: new Date().toISOString() });

      const BATCH = 5;
      for (let i = 0; i < uploads.length; i += BATCH) {
        await db.collection("proyectos").doc(_current.id).set(
          { evidencias: firebase.firestore.FieldValue.arrayUnion(...uploads.slice(i, i + BATCH)) },
          { merge: true }
        );
      }

      // Recargar doc completo para reflejar cambios
      const snap = await db.collection("proyectos").doc(_current.id).get();
      _current = { id: _current.id, ...snap.data() };
      llenarDetalle(_current);
      // Actualizar conteo ligero en lista
      _all = _all.map(p => p.id === _current.id
        ? { ...p, evidencias: (_current.evidencias || []).map(ev => ({ tipo: ev.tipo, contentType: ev.contentType, name: ev.name, nombre: ev.nombre, url: ev.url })) }
        : p);
      aplicarFiltro();
      if (inputEvid) inputEvid.value = "";
      if (inputLink) inputLink.value = "";
    } catch (e) {
      alert("Error subiendo evidencia: " + (e?.message || e));
    } finally {
      if (btnSubir) { btnSubir.disabled = false; btnSubir.textContent = "Subir"; }
    }
  }

  /* ── Agregar documento al proyecto ──────────────── */
  async function agregarDocumentoProyecto(tipo, nombre, url, base64, contentType, fileName) {
    if (!_current) return;
    const doc = {
      tipo, nombre,
      url: url || null,
      base64: base64 || null,
      contentType: contentType || null,
      fileName: fileName || null,
      estado: "pendiente",
      creadoEn: new Date().toISOString()
    };
    await db.collection("proyectos").doc(_current.id).set(
      { documentos: firebase.firestore.FieldValue.arrayUnion(doc) },
      { merge: true }
    );
    const snap = await db.collection("proyectos").doc(_current.id).get();
    _current = { id: _current.id, ...snap.data() };
    llenarDetalle(_current);
  }

  /* ── Exponer globales ────────────────────────────── */
  window.verDetalle               = verDetalle;
  window.cerrarDetalle            = cerrarDetalle;
  window.subirEvidencia           = subirEvidencia;
  window.abrirLightbox            = abrirLightbox;
  window.cerrarLightbox           = cerrarLightbox;
  window.agregarDocumentoProyecto = agregarDocumentoProyecto;

  /* ── Init ────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", () => {
    Promise.resolve(window.__domkaFirebaseReady).then(async () => {
      if (!window.auth || !window.db) return;
      window.auth.onAuthStateChanged(async (u) => {
        const emailEl = document.getElementById("user-email");
        if (emailEl) emailEl.textContent = u?.email || "Usuario";
        if (!u) return;

        _perfil = typeof window.cargarPerfil === "function"
          ? await window.cargarPerfil(u).catch(() => null)
          : null;

        if (formProyecto) {
          const canCreate = ["admin","comercial","tecnico"].includes(_perfil?.role);
          formProyecto.closest("#crear-proyecto-card")?.classList.toggle("hidden", !canCreate);
          if (canCreate) {
            await Promise.all([cargarClientesForm(), cargarUsuariosSistema()]);
            formProyecto.addEventListener("submit", crearProyecto);
          }
        }
        await cargar();
      });
    }).catch(() => {});
  });
})();
