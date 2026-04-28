// js/usuarios.js
(() => {
  const formNuevo = document.getElementById("form-nuevo-usuario");
  const tabla = document.getElementById("tabla-usuarios");
  const modal = document.getElementById("modal-edit-usuario");
  const formEdit = document.getElementById("form-edit-usuario");

  const ROLE_LABEL = {
    admin: "Administrador",
    comercial: "Comercial",
    tecnico: "Tecnico",
    contador: "Contador",
    finanzas: "Finanzas",
    rrhh: "RRHH",
    client: "Cliente"
  };

  function normalizeRole(role) {
    const key = String(role || "").toLowerCase().trim();
    if (key === "cliente") return "client";
    if (key === "operador") return "tecnico";
    return key;
  }

  function fmtDate(value) {
    const d = value?.toDate ? value.toDate() : value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("es-CO");
  }

  async function requireAdmin() {
    const user = window.auth?.currentUser;
    if (!user) throw new Error("Sin sesion.");
    const snap = await window.db.collection("users").doc(user.uid).get();
    const me = snap.exists ? snap.data() : null;
    if (!me || normalizeRole(me.role) !== "admin") {
      alert("Solo admin puede gestionar usuarios.");
      window.location.href = "/dashboard.html";
      throw new Error("No autorizado");
    }
  }

  async function crearUsuarioAuth(email, password) {
    const cfg = window.firebase.app().options;
    const tempName = `domka-temp-${Date.now()}`;
    const tempApp = window.firebase.initializeApp(cfg, tempName);
    try {
      const tempAuth = tempApp.auth();
      const cred = await tempAuth.createUserWithEmailAndPassword(email, password);
      const uid = cred.user?.uid;
      await tempAuth.signOut();
      return uid;
    } finally {
      await tempApp.delete().catch(() => {});
    }
  }

  async function cargarUsuarios() {
    const snap = await window.db.collection("users").orderBy("createdAt", "desc").get();
    if (snap.empty) {
      tabla.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-400">Sin usuarios</td></tr>`;
      return;
    }

    let html = "";
    snap.forEach((doc) => {
      const u = doc.data() || {};
      const role = normalizeRole(u.role || "client");
      const active = u.activo !== false;
      html += `
        <tr class="border-b">
          <td class="p-3">
            <div class="font-semibold text-gray-700">${u.nombre || "-"}</div>
            <div class="text-xs text-gray-400">${u.email || "-"}</div>
          </td>
          <td class="p-3 text-gray-700">${ROLE_LABEL[role] || role}</td>
          <td class="p-3">
            <span class="text-xs px-2 py-1 rounded-full ${active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}">
              ${active ? "Activo" : "Inactivo"}
            </span>
          </td>
          <td class="p-3 text-gray-500">${fmtDate(u.createdAt)}</td>
          <td class="p-3">
            <button class="text-xs px-2 py-1 border rounded mr-2" onclick="editarUsuario('${doc.id}')">Editar</button>
            <button class="text-xs px-2 py-1 border rounded" onclick="toggleUsuarioActivo('${doc.id}', ${active ? "false" : "true"})">
              ${active ? "Desactivar" : "Activar"}
            </button>
          </td>
        </tr>
      `;
    });
    tabla.innerHTML = html;
  }

  async function crearUsuario(e) {
    e.preventDefault();
    const nombre = document.getElementById("nuevo-nombre").value.trim();
    const email = document.getElementById("nuevo-email").value.trim().toLowerCase();
    const password = document.getElementById("nuevo-password").value;
    const role = normalizeRole(document.getElementById("nuevo-rol").value);
    const clienteIdInput = document.getElementById("nuevo-clienteId").value.trim();
    const clienteId = role === "client" ? clienteIdInput : null;

    if (!nombre || !email || !password) return;
    if (role === "client" && !clienteId) {
      alert("Para rol cliente debes indicar clienteId.");
      return;
    }

    try {
      const uid = await crearUsuarioAuth(email, password);
      await window.db.collection("users").doc(uid).set({
        nombre,
        email,
        role,
        clienteId,
        activo: true,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      formNuevo.reset();
      await cargarUsuarios();
      alert("Usuario creado correctamente.");
    } catch (err) {
      alert("No se pudo crear el usuario: " + (err?.message || err));
    }
  }

  async function editarUsuario(uid) {
    const snap = await window.db.collection("users").doc(uid).get();
    if (!snap.exists) return;
    const u = snap.data() || {};
    document.getElementById("edit-uid").value = uid;
    document.getElementById("edit-nombre").value = u.nombre || "";
    document.getElementById("edit-rol").value = normalizeRole(u.role || "client");
    modal.classList.remove("hidden");
  }

  function cerrarModalEdit() {
    modal.classList.add("hidden");
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    const uid = document.getElementById("edit-uid").value;
    const nombre = document.getElementById("edit-nombre").value.trim();
    const role = normalizeRole(document.getElementById("edit-rol").value);
    await window.db.collection("users").doc(uid).set({ nombre, role }, { merge: true });
    cerrarModalEdit();
    await cargarUsuarios();
  }

  async function toggleUsuarioActivo(uid, nextActivo) {
    await window.db.collection("users").doc(uid).set({ activo: !!nextActivo }, { merge: true });
    await cargarUsuarios();
  }

  window.editarUsuario = editarUsuario;
  window.cerrarModalEdit = cerrarModalEdit;
  window.toggleUsuarioActivo = toggleUsuarioActivo;

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await Promise.resolve(window.__domkaFirebaseReady);
      if (!window.auth || !window.db) throw new Error("Firebase no inicializado.");
      await requireAdmin();
      formNuevo?.addEventListener("submit", crearUsuario);
      formEdit?.addEventListener("submit", guardarEdicion);
      await cargarUsuarios();
    } catch (err) {
      console.error(err);
    }
  });
})();
