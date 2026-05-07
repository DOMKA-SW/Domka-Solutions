// js/proyectos.js — v2.0 DOMKA
(() => {
  /* ── Refs admin form ─────────────────────────────── */
  const tbody        = document.getElementById("tabla-proyectos");
  const empty        = document.getElementById("empty-proyectos");
  const formProyecto = document.getElementById("form-proyecto");
  const clienteSelect= document.getElementById("proy-cliente");
  const tecnicoInput = document.getElementById("proy-tecnico");
  const estadoSelect = document.getElementById("proy-estado");
  const descripcionInput = document.getElementById("proy-descripcion");
  const nombreInput  = document.getElementById("proy-nombre");

  /* ── Modal detalle ───────────────────────────────── */
  const modal        = document.getElementById("modal-detalle");
  const inputEvid    = document.getElementById("evidencia-input");
  const inputLink    = document.getElementById("evidencia-link");
  const btnSubir     = document.getElementById("btn-subir-ev");

  let _all    = [];
  let _filtro = "todos";
  let _current = null;
  let _perfil  = null;

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
      // Lunes de esa semana
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const lun = new Date(d.setDate(diff));
      return `Semana del ${lun.toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"})}`;
    } catch { return "Sin fecha"; }
  }

  function badge(estado) {
    const map = {
      pendiente:    { t:"Pendiente",     c:"bg-yellow-100 text-yellow-800" },
      en_ejecucion: { t:"En ejecución",  c:"bg-blue-100 text-blue-800" },
      finalizado:   { t:"Finalizado",    c:"bg-green-100 text-green-800" },
      suspendido:   { t:"Suspendido",    c:"bg-red-100 text-red-800" }
    };
    const v = map[estado] || map.pendiente;
    return `<span class="text-xs font-semibold px-2 py-1 rounded-full ${v.c}">${v.t}</span>`;
  }

  function tipoIcon(ev) {
    const ct = (ev.contentType || ev.tipo || "").toLowerCase();
    const name = (ev.name || ev.nombre || "").toLowerCase();
    if (ct.startsWith("image/")) return "🖼️";
    if (ct.startsWith("video/")) return "🎬";
    if (ct === "application/pdf" || name.endsWith(".pdf")) return "📄";
    if (name.endsWith(".zip") || name.endsWith(".rar")) return "🗜️";
    if (ev.tipo === "link") return "🔗";
    return "📎";
  }

  /* ── Filtros ─────────────────────────────────────── */
  function aplicarFiltro() {
    const list = _filtro === "todos" ? _all : _all.filter(p => (p.estado||"pendiente") === _filtro);
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

  /* ── Tabla principal ─────────────────────────────── */
  function render(list) {
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = "";
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    tbody.innerHTML = list.map((p, idx) => {
      const evCount  = (p.evidencias || []).length;
      const docCount = (p.documentos || []).length;
      return `
        <tr class="border-b hover:bg-gray-50 cursor-pointer" onclick="verDetalle('${p.id}')">
          <td class="p-3 text-gray-400 text-xs">${String(idx+1).padStart(2,"0")}</td>
          <td class="p-3">
            <div class="font-medium text-sm">${esc(p.numero || p.id.slice(0,8).toUpperCase())}</div>
            <div class="text-xs text-gray-400">${esc(p.nombre || "")}</div>
          </td>
          <td class="p-3 text-sm">${esc(p.nombreCliente || p.clienteNombre || "—")}</td>
          <td class="p-3 text-sm">${esc(p.tecnico || "—")}</td>
          <td class="p-3">${badge(p.estado || "pendiente")}</td>
          <td class="p-3 text-xs text-gray-500">
            ${evCount  ? `<span class="mr-2">📷 ${evCount}</span>` : ""}
            ${docCount ? `<span>📄 ${docCount}</span>` : ""}
            ${(!evCount && !docCount) ? "—" : ""}
          </td>
          <td class="p-3 text-xs text-gray-400">${fmtDate(p.creadoEn || p.createdAt)}</td>
        </tr>`;
    }).join("");
  }

  /* ── Cargar proyectos ────────────────────────────── */
  async function cargar() {
    try {
      let query = db.collection("proyectos");
      if (_perfil?.role === "client") {
        if (_perfil?.empresaId)  query = query.where("empresaId","==",_perfil.empresaId);
        else if (_perfil?.clienteId) query = query.where("clienteId","==",_perfil.clienteId);
      }
      const snap = await query.orderBy("creadoEn","desc").get();
      _all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      aplicarFiltro();
    } catch (e) {
      console.error(e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-600">Error cargando proyectos.</td></tr>`;
    }
  }

  /* ── Clientes para el form ───────────────────────── */
  async function cargarClientesForm() {
    if (!clienteSelect) return;
    clienteSelect.innerHTML = `<option value="">Selecciona cliente</option>`;
    const snap = await db.collection("clientes").orderBy("nombre").get()
      .catch(() => db.collection("clientes").get());
    snap.forEach(doc => {
      const c = doc.data() || {};
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.textContent = c.nombre || c.empresa || c.email || doc.id;
      clienteSelect.appendChild(opt);
    });
  }

  /* ── Crear proyecto ──────────────────────────────── */
  async function crearProyecto(e) {
    e.preventDefault();
    if (!_perfil) return;
    if (!["admin","comercial","tecnico"].includes(_perfil.role)) {
      alert("Tu rol no tiene permiso para crear proyectos."); return;
    }
    const clienteId = (clienteSelect?.value || "").trim();
    if (!clienteId) { alert("Selecciona un cliente."); return; }

    const clienteDoc = await db.collection("clientes").doc(clienteId).get();
    const clienteData = clienteDoc.data() || {};
    const numero = `PRY-${Date.now().toString().slice(-6)}`;
    const payload = {
      numero,
      nombre: (nombreInput?.value || "").trim(),
      clienteId,
      empresaId: clienteData.empresaId || null,
      nombreCliente: clienteData.nombre || clienteData.empresa || "Cliente",
      tecnico: (tecnicoInput?.value || "").trim(),
      estado: (estadoSelect?.value || "pendiente").trim(),
      descripcion: (descripcionInput?.value || "").trim(),
      evidencias: [],
      documentos: [],
      creadoPor: window.auth?.currentUser?.uid || null,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("proyectos").add(payload);
    formProyecto.reset();
    await cargar();
  }

  /* ── Modal detalle ───────────────────────────────── */
  function llenarDetalle(p) {
    // Header
    document.getElementById("detalle-numero").textContent   = p.numero || p.id.slice(0,8).toUpperCase();
    const nombreEl = document.getElementById("detalle-nombre");
    if (nombreEl) nombreEl.textContent = p.nombre || "";
    document.getElementById("detalle-cliente").textContent  = p.nombreCliente || p.clienteNombre || "—";
    document.getElementById("detalle-tecnico").textContent  = p.tecnico || "—";
    document.getElementById("detalle-descripcion").textContent = p.descripcion || "—";
    const estadoWrap = document.querySelector("#detalle-estado-wrap > div");
    if (estadoWrap) estadoWrap.innerHTML = badge(p.estado || "pendiente");

    // Fechas
    const fInicio = document.getElementById("detalle-fecha-inicio");
    const fCierre = document.getElementById("detalle-fecha-cierre");
    if (fInicio) fInicio.textContent = fmtDate(p.fechaInicio) || "—";
    if (fCierre) fCierre.textContent = fmtDate(p.fechaCierre) || "—";

    // ── Documentos del proyecto ─────────────────────
    const docsEl = document.getElementById("detalle-documentos");
    if (docsEl) {
      const docs = p.documentos || [];
      if (!docs.length) {
        docsEl.innerHTML = `<p class="text-gray-400 text-sm">Sin documentos.</p>`;
      } else {
        const tiposOrden = ["Acta de Inicio","Contrato","Acta de Cierre","Informe","Otro"];
        const agrupados = {};
        docs.forEach(d => {
          const t = d.tipo || "Otro";
          if (!agrupados[t]) agrupados[t] = [];
          agrupados[t].push(d);
        });
        docsEl.innerHTML = tiposOrden
          .filter(t => agrupados[t])
          .concat(Object.keys(agrupados).filter(t => !tiposOrden.includes(t)))
          .map(tipo => `
            <div class="mb-3">
              <p class="text-xs font-bold uppercase tracking-wider text-green-700 mb-1">${esc(tipo)}</p>
              ${agrupados[tipo].map(d => `
                <div class="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                  <span class="text-sm">📄</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">${esc(d.nombre || d.tipo)}</div>
                    <div class="text-xs text-gray-400">${fmtDate(d.creadoEn)} · ${d.estado === "aprobado" ? "✅ Aprobado" : d.estado === "rechazado" ? "❌ Rechazado" : "⏳ Pendiente"}</div>
                  </div>
                  ${d.url ? `<a href="${esc(d.url)}" target="_blank" class="text-xs text-green-700 underline whitespace-nowrap">Ver</a>` : ""}
                </div>`).join("")}
            </div>`).join("");
      }
    }

    // ── Evidencias agrupadas por semana ─────────────
    const galeria = document.getElementById("galeria-evidencias");
    if (!galeria) return;
    const evs = (p.evidencias || []).slice().reverse();
    if (!evs.length) {
      galeria.innerHTML = `<p class="text-gray-400 text-sm">Sin evidencias.</p>`;
      return;
    }

    // Agrupar por semana
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

  async function verDetalle(id) {
    _current = _all.find(p => p.id === id) || null;
    if (!_current) return;
    llenarDetalle(_current);
    modal.classList.remove("hidden");
  }

  function cerrarDetalle() {
    modal.classList.add("hidden");
    _current = null;
    if (inputEvid) inputEvid.value = "";
    if (inputLink) inputLink.value = "";
  }

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

  /* ── Subir evidencias (archivo + link) ───────────── */
  async function subirEvidencia() {
    if (!_current) return;

    const files = Array.from(inputEvid?.files || []);
    const link  = (inputLink?.value || "").trim();

    if (!files.length && !link) {
      alert("Selecciona archivos o ingresa un link."); return;
    }

    btnSubir.disabled   = true;
    btnSubir.textContent = "Subiendo…";

    try {
      const uploads = [];

      // Archivos
      for (const f of files) {
        if (f.size > 5 * 1024 * 1024) throw new Error(`${f.name} supera 5 MB.`);
        const base64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload  = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(f);
        });
        uploads.push({
          name: f.name,
          contentType: f.type,
          size: f.size,
          base64,
          uploadedAt: new Date().toISOString()
        });
      }

      // Link externo
      if (link) {
        uploads.push({
          tipo: "link",
          url: link,
          name: link,
          uploadedAt: new Date().toISOString()
        });
      }

      // Guardar en lotes de 5 para evitar límite de 1MB Firestore
      const BATCH = 5;
      for (let i = 0; i < uploads.length; i += BATCH) {
        const chunk = uploads.slice(i, i + BATCH);
        await db.collection("proyectos").doc(_current.id).set({
          evidencias: firebase.firestore.FieldValue.arrayUnion(...chunk)
        }, { merge: true });
      }

      // Refrescar
      const snap = await db.collection("proyectos").doc(_current.id).get();
      const updated = { id: _current.id, ...snap.data() };
      _all     = _all.map(p => p.id === _current.id ? updated : p);
      _current = updated;
      llenarDetalle(_current);
      aplicarFiltro();
      if (inputEvid) inputEvid.value = "";
      if (inputLink) inputLink.value = "";
    } catch (e) {
      alert("Error subiendo evidencia: " + (e?.message || e));
    } finally {
      btnSubir.disabled   = false;
      btnSubir.textContent = "Subir";
    }
  }

  /* ── Documentos del proyecto (admin) ─────────────── */
  async function agregarDocumentoProyecto(tipo, nombre, url) {
    if (!_current) return;
    const doc = {
      tipo, nombre, url: url || null,
      estado: "pendiente",
      creadoEn: new Date().toISOString()
    };
    await db.collection("proyectos").doc(_current.id).set({
      documentos: firebase.firestore.FieldValue.arrayUnion(doc)
    }, { merge: true });
    const snap = await db.collection("proyectos").doc(_current.id).get();
    const updated = { id: _current.id, ...snap.data() };
    _all     = _all.map(p => p.id === _current.id ? updated : p);
    _current = updated;
    llenarDetalle(_current);
  }

  /* ── Exponer globales ────────────────────────────── */
  window.verDetalle              = verDetalle;
  window.cerrarDetalle           = cerrarDetalle;
  window.subirEvidencia          = subirEvidencia;
  window.abrirLightbox           = abrirLightbox;
  window.cerrarLightbox          = cerrarLightbox;
  window.agregarDocumentoProyecto= agregarDocumentoProyecto;

  /* ── Init ────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", () => {
    Promise.resolve(window.__domkaFirebaseReady).then(() => {
      if (!window.auth || !window.db) return;
      auth.onAuthStateChanged(async (u) => {
        const el = document.getElementById("user-email");
        if (el) el.textContent = u?.email || "Usuario";
        if (!u) return;
        _perfil = (typeof window.cargarPerfil === "function")
          ? await window.cargarPerfil(u).catch(() => null)
          : null;
        if (formProyecto) {
          const canCreate = ["admin","comercial","tecnico"].includes(_perfil?.role);
          formProyecto.closest("#crear-proyecto-card")?.classList.toggle("hidden", !canCreate);
          if (canCreate) {
            await cargarClientesForm();
            formProyecto.addEventListener("submit", crearProyecto);
          }
        }
        await cargar();
      });
    }).catch(console.error);
  });
})();
