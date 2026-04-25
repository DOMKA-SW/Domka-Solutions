// js/proyectos.js
(() => {
  const tbody = document.getElementById("tabla-proyectos");
  const empty = document.getElementById("empty-proyectos");

  const modal = document.getElementById("modal-detalle");
  const galeria = document.getElementById("galeria-evidencias");
  const inputEvid = document.getElementById("evidencia-input");
  const btnSubir = document.getElementById("btn-subir-ev");

  let _all = [];
  let _filtro = "todos";
  let _current = null;

  function fmtDate(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
      return d ? d.toLocaleDateString("es-CO") : "—";
    } catch { return "—"; }
  }

  function badge(estado) {
    const map = {
      pendiente:    { t: "Pendiente",    c: "bg-yellow-100 text-yellow-800" },
      en_ejecucion: { t: "En ejecución", c: "bg-blue-100 text-blue-800" },
      finalizado:   { t: "Finalizado",   c: "bg-green-100 text-green-800" },
      suspendido:   { t: "Suspendido",   c: "bg-red-100 text-red-800" }
    };
    const v = map[estado] || map.pendiente;
    return `<span class="text-xs font-semibold px-2 py-1 rounded-full ${v.c}">${v.t}</span>`;
  }

  function aplicarFiltro() {
    const list = _filtro === "todos" ? _all : _all.filter(p => (p.estado || "pendiente") === _filtro);
    render(list);
  }

  function render(list) {
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = "";
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    tbody.innerHTML = list.map((p, idx) => {
      const evCount = (p.evidencias || []).length;
      return `
        <tr class="border-b hover:bg-gray-50 cursor-pointer" onclick="verDetalle('${p.id}')">
          <td class="p-3">${String(idx + 1).padStart(2, "0")}</td>
          <td class="p-3">${esc(p.nombreCliente || p.clienteNombre || "—")}</td>
          <td class="p-3">${esc(p.tecnico || "—")}</td>
          <td class="p-3">${badge(p.estado || "pendiente")}</td>
          <td class="p-3">${evCount ? `📷 ${evCount}` : "—"}</td>
          <td class="p-3">${fmtDate(p.creadoEn || p.createdAt)}</td>
        </tr>
      `;
    }).join("");
  }

  async function cargar() {
    try {
      const snap = await db.collection("proyectos").orderBy("creadoEn", "desc").get();
      _all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      aplicarFiltro();
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-600">Error cargando proyectos.</td></tr>`;
    }
  }

  function setFiltroUI() {
    document.querySelectorAll("[data-filtro]").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-filtro") === _filtro);
    });
  }

  document.querySelectorAll("[data-filtro]").forEach(btn => {
    btn.addEventListener("click", () => {
      _filtro = btn.getAttribute("data-filtro");
      setFiltroUI();
      aplicarFiltro();
    });
  });

  function llenarDetalle(p) {
    document.getElementById("detalle-numero").textContent = p.numero || p.id.substring(0, 8).toUpperCase();
    document.getElementById("detalle-cliente").textContent = p.nombreCliente || p.clienteNombre || "—";
    document.getElementById("detalle-tecnico").textContent = p.tecnico || "—";
    document.getElementById("detalle-descripcion").textContent = p.descripcion || "—";

    const est = p.estado || "pendiente";
    document.querySelector("#detalle-estado-wrap > div").innerHTML = badge(est);

    // evidencias
    const evs = (p.evidencias || []).slice().reverse();
    if (!evs.length) {
      galeria.innerHTML = `<p class="text-gray-400 text-sm">Sin evidencias.</p>`;
    } else {
      galeria.innerHTML = evs.map(ev => {
        const isImg = (ev.contentType || ev.tipo || "").startsWith("image/");
        const url = ev.base64;
        if (!url) return "";
        if (isImg) {
          return `<img class="evidence-thumb rounded-lg" src="${url}" alt="${esc(ev.name || ev.nombre || "")}" onclick="abrirLightbox('${url}')">`;
        }
        return `<a class="text-sm underline" target="_blank" href="${url}">📎 ${esc(ev.name || ev.nombre || "Archivo")}</a>`;
      }).join("");
    }
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
  }

  function abrirLightbox(src) {
    const lb = document.getElementById("lightbox");
    const img = document.getElementById("lightbox-img");
    if (!lb || !img) return;
    img.src = src;
    lb.classList.remove("hidden");
  }

  function cerrarLightbox() {
    const lb = document.getElementById("lightbox");
    const img = document.getElementById("lightbox-img");
    if (img) img.src = "";
    if (lb) lb.classList.add("hidden");
  }

  async function subirEvidencia() {
    if (!_current) return;
    const files = Array.from(inputEvid?.files || []);
    if (!files.length) return alert("Selecciona al menos un archivo.");

    btnSubir.disabled = true;
    btnSubir.textContent = "Subiendo…";
    try {
      const uploads = [];
      for (const f of files) {
        if (f.size > 5 * 1024 * 1024) throw new Error(`${f.name} supera 5MB.`);

        const base64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(f);
        });

        uploads.push({
          name: f.name,
          contentType: f.type,
          size: f.size,
          base64,
          uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      await db.collection("proyectos").doc(_current.id).set({
        evidencias: firebase.firestore.FieldValue.arrayUnion(...uploads)
      }, { merge: true });

      // refrescar
      const snap = await db.collection("proyectos").doc(_current.id).get();
      const updated = { id: _current.id, ...snap.data() };
      _all = _all.map(p => p.id === _current.id ? updated : p);
      _current = updated;
      llenarDetalle(_current);
      aplicarFiltro();
      if (inputEvid) inputEvid.value = "";
    } catch (e) {
      alert("Error subiendo evidencia: " + (e?.message || e));
    } finally {
      btnSubir.disabled = false;
      btnSubir.textContent = "Subir";
    }
  }

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  window.verDetalle = verDetalle;
  window.cerrarDetalle = cerrarDetalle;
  window.subirEvidencia = subirEvidencia;
  window.abrirLightbox = abrirLightbox;
  window.cerrarLightbox = cerrarLightbox;

  document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged(u => {
      const el = document.getElementById("user-email");
      if (el) el.textContent = u?.email || "Usuario";
    });
    cargar();
  });
})();

