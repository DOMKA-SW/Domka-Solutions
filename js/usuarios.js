// js/usuarios.js
(() => {
  const formNuevo = document.getElementById("form-nuevo-usuario");
  const tabla = document.getElementById("tabla-usuarios");
  const modal = document.getElementById("modal-edit-usuario");
  const formEdit = document.getElementById("form-edit-usuario");

  // Rol del usuario actual en sesión (se establece en DOMContentLoaded)
  let _myRole = null;

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

  // Devuelve el rol del usuario en sesión.
  // Admin → acceso completo.
  // Comercial → acceso de solo lectura (clientes y comerciales).
  // Otros → redirige a dashboard.
  async function requireAccess() {
    const user = window.auth?.currentUser || await new Promise((resolve) => {
      if (!window.auth?.onAuthStateChanged) return resolve(null);
      const unsub = window.auth.onAuthStateChanged((u) => {
        unsub();
        resolve(u || null);
      });
    });
    if (!user) throw new Error("Sin sesion.");
    const snap = await window.db.collection("users").doc(user.uid).get();
    const me = snap.exists ? snap.data() : null;
    const role = normalizeRole(me?.role || "");
    if (!["admin", "comercial"].includes(role)) {
      window.location.href = "/dashboard.html";
      throw new Error("No autorizado");
    }
    return role;
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

  // Carga la lista de clientes en el select cuando se elige rol "client"
  async function cargarClientesSelect() {
    const sel = document.getElementById("nuevo-clienteId");
    if (!sel || sel.tagName !== "SELECT") return;
    if (sel.options.length > 1) return; // ya cargado
    sel.innerHTML = `<option value="">— Selecciona el cliente —</option>`;
    try {
      const snap = await window.db.collection("clientes").orderBy("nombre").get()
        .catch(() => window.db.collection("clientes").get());
      snap.forEach(doc => {
        const d = doc.data() || {};
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = [d.nombre, d.empresa].filter(Boolean).join(" — ") || doc.id;
        sel.appendChild(opt);
      });
    } catch (_) { /* sin acceso, dejar vacío */ }
  }

  async function cargarUsuarios() {
    let snap;
    if (_myRole === "comercial") {
      // Comercial solo ve usuarios tipo cliente y comercial
      const [snapClient, snapCom] = await Promise.all([
        window.db.collection("users").where("role", "in", ["client", "cliente"]).get(),
        window.db.collection("users").where("role", "==", "comercial").get()
      ]);
      // Merge y deduplicar
      const docsMap = new Map();
      [...snapClient.docs, ...snapCom.docs].forEach(d => docsMap.set(d.id, d));
      snap = { docs: [...docsMap.values()] };
    } else {
      snap = await window.db.collection("users").orderBy("createdAt", "desc").get();
    }

    if (!snap.docs.length) {
      tabla.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-400">Sin usuarios</td></tr>`;
      return;
    }

    let html = "";
    snap.docs.forEach((doc) => {
      const u = doc.data() || {};
      const role = normalizeRole(u.role || "client");
      const active = u.activo !== false;

      // Comercial no puede editar ni activar/desactivar
      const acciones = _myRole === "admin"
        ? `<button class="text-xs px-2 py-1 border rounded mr-2" onclick="editarUsuario('${doc.id}')">Editar</button>
           <button class="text-xs px-2 py-1 border rounded" onclick="toggleUsuarioActivo('${doc.id}', ${active ? "false" : "true"})">
             ${active ? "Desactivar" : "Activar"}
           </button>`
        : `<span class="text-xs text-gray-400 italic">Solo lectura</span>`;

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
          <td class="p-3">${acciones}</td>
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
      await window.db.collection("usuarios").doc(uid).set({
        nombre,
        email,
        rol: role === "client" ? "cliente" : role,
        clienteId,
        activo: true,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(() => {});
      formNuevo.reset();
      await cargarUsuarios();
      alert("Usuario creado correctamente.");
    } catch (err) {
      if (err?.code === "auth/email-already-in-use") {
        alert("Ese correo ya existe en Authentication. Para cliente usa el flujo de invitacion desde Clientes.");
      } else {
        alert("No se pudo crear el usuario: " + (err?.message || err));
      }
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
    await window.db.collection("usuarios").doc(uid).set({
      nombre,
      rol: role === "client" ? "cliente" : role
    }, { merge: true }).catch(() => {});
    cerrarModalEdit();
    await cargarUsuarios();
  }

  async function toggleUsuarioActivo(uid, nextActivo) {
    await window.db.collection("users").doc(uid).set({ activo: !!nextActivo }, { merge: true });
    await window.db.collection("usuarios").doc(uid).set({ activo: !!nextActivo }, { merge: true }).catch(() => {});
    await cargarUsuarios();
  }

  window.editarUsuario = editarUsuario;
  window.cerrarModalEdit = cerrarModalEdit;
  window.toggleUsuarioActivo = toggleUsuarioActivo;

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await Promise.resolve(window.__domkaFirebaseReady);
      if (!window.auth || !window.db) throw new Error("Firebase no inicializado.");

      _myRole = await requireAccess();

      // Ocultar formulario de creación si no es admin
      if (_myRole !== "admin") {
        const cardNuevo = document.getElementById("card-nuevo-usuario") || formNuevo?.closest("section, div.card, div[class*='card']");
        if (formNuevo) formNuevo.closest("section, .card, [id*='nuevo']")?.remove();
        if (formNuevo) formNuevo.style.display = "none";
        // Mostrar aviso de modo lectura
        const titulo = document.querySelector(".page-heading, h1, h2");
        if (titulo) {
          const aviso = document.createElement("p");
          aviso.className = "text-xs text-amber-600 mt-1";
          aviso.textContent = "Modo lectura — solo ves usuarios tipo Cliente y Comercial.";
          titulo.insertAdjacentElement("afterend", aviso);
        }
      }

      formNuevo?.addEventListener("submit", crearUsuario);
      formEdit?.addEventListener("submit", guardarEdicion);

      // Mostrar/ocultar campo clienteId según rol y cargar select
      const rolSelect = document.getElementById("nuevo-rol");
      const clienteWrap = document.getElementById("nuevo-clienteId-wrap");
      if (rolSelect && clienteWrap) {
        rolSelect.addEventListener("change", async () => {
          const esCliente = rolSelect.value === "client";
          clienteWrap.classList.toggle("hidden", !esCliente);
          if (esCliente) await cargarClientesSelect();
        });
        clienteWrap.classList.toggle("hidden", rolSelect.value !== "client");
      }

      await cargarUsuarios();
    } catch (err) {
      console.error(err);
    }
  });
})();
