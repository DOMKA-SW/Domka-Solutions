// js/documentos.js
(() => {
  const form = document.getElementById("form-documento");
  const selCliente = document.getElementById("doc-cliente");
  const tipoEl = document.getElementById("doc-tipo");
  const descEl = document.getElementById("doc-descripcion");
  const pdfEl = document.getElementById("doc-pdf");

  const tbody = document.getElementById("tabla-documentos");
  const empty = document.getElementById("empty-documentos");

  let _docs = [];
  let _clientesById = {};

  function fmtDate(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
      return d ? d.toLocaleDateString("es-CO") : "—";
    } catch { return "—"; }
  }

  function badge(estado) {
    const map = {
      pendiente: { t: "Pendiente", c: "bg-yellow-100 text-yellow-800" },
      aprobado:  { t: "Aprobado",  c: "bg-green-100 text-green-800" },
      rechazado: { t: "Rechazado", c: "bg-red-100 text-red-800" }
    };
    const v = map[estado] || map.pendiente;
    return `<span class="text-xs font-semibold px-2 py-1 rounded-full ${v.c}">${v.t}</span>`;
  }

  async function cargarClientes() {
    const snap = await db.collection("clientes").orderBy("nombre").get().catch(async () => db.collection("clientes").get());
    _clientesById = {};
    selCliente.innerHTML = `<option value="">— Selecciona —</option>`;
    snap.forEach(d => {
      const c = d.data() || {};
      _clientesById[d.id] = c;
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = c.nombre || c.empresa || c.email || d.id;
      selCliente.appendChild(opt);
    });
  }

  async function cargarDocs() {
    try {
      const snap = await db.collection("documentos").orderBy("creadoEn", "desc").get();
      _docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    } catch (e) {
      console.error(e);
      tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-600">Error cargando documentos.</td></tr>`;
    }
  }

  function render() {
    if (!_docs.length) {
      tbody.innerHTML = "";
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    tbody.innerHTML = _docs.map((d, idx) => {
      const cliente = _clientesById[d.clienteId];
      const clienteNombre = cliente?.nombre || cliente?.empresa || d.clienteId || "—";
      const estado = d.estado || "pendiente";
      const pdfData = d.pdfBase64 || "";
      return `
        <tr class="border-b hover:bg-gray-50">
          <td class="p-3">${String(idx + 1).padStart(2, "0")}</td>
          <td class="p-3">${esc(clienteNombre)}</td>
          <td class="p-3">${esc((d.tipo || "Documento") + " · " + (d.descripcion || ""))}</td>
          <td class="p-3">${badge(estado)}</td>
          <td class="p-3">${fmtDate(d.creadoEn || d.createdAt)}</td>
          <td class="p-3">
            ${pdfData ? `<a class="text-sm underline" target="_blank" href="${pdfData}">Ver PDF</a>` : "—"}
          </td>
        </tr>
      `;
    }).join("");
  }

  async function pdfToBase64(file) {
    if (!file) return null;
    if (file.size > 1 * 1024 * 1024) throw new Error("El PDF supera 1MB.");
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    return {
      base64,
      name: file.name,
      contentType: file.type || "application/pdf",
      size: file.size
    };
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const clienteId = selCliente.value;
    if (!clienteId) return alert("Selecciona un cliente.");

    try {
      const pdfFile = pdfEl?.files?.[0] || null;
      const pdf = await pdfToBase64(pdfFile);

      const doc = {
        clienteId,
        tipo: tipoEl.value,
        descripcion: descEl.value.trim(),
        estado: "pendiente",
        creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
        ...(pdf ? { pdfBase64: pdf.base64, pdfName: pdf.name, pdfContentType: pdf.contentType, pdfSize: pdf.size } : {})
      };

      await db.collection("documentos").add(doc);
      form.reset();
      await cargarDocs();
    } catch (e2) {
      alert("Error guardando documento: " + (e2?.message || e2));
    }
  });

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    auth.onAuthStateChanged(u => {
      const el = document.getElementById("user-email");
      if (el) el.textContent = u?.email || "Usuario";
    });
    await cargarClientes();
    await cargarDocs();
  });
})();

