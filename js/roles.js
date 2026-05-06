// js/roles.js
// Helpers de roles/perfil en Firestore.
(() => {
  const ROLE_ORDER = ["client", "tecnico", "comercial", "contador", "rrhh", "finanzas", "admin"];
  const ROLE_ALIASES = {
    admin: "admin",
    comercial: "comercial",
    finanzas: "finanzas",
    contador: "contador",
    rrhh: "rrhh",
    tecnico: "tecnico",
    operador: "tecnico",
    client: "client",
    cliente: "client"
  };

  function normalizeRole(role) {
    const key = String(role || "").toLowerCase().trim();
    return ROLE_ALIASES[key] || "client";
  }

  function roleRank(role) {
    const idx = ROLE_ORDER.indexOf(normalizeRole(role));
    return idx === -1 ? 0 : idx;
  }

  async function cargarPerfil(user) {
    if (!user) return null;
    if (!window.db) throw new Error("Firestore no inicializado (db).");

    let snap = null;
    try {
      snap = await window.db.collection("users").doc(user.uid).get();
    } catch (_) {}
    async function completarVinculos(perfil) {
      if (!perfil || perfil.role !== "client") return perfil;
      let out = { ...perfil };
      if (!out.clienteId && out.email) {
        try {
          const email = String(out.email).trim().toLowerCase();
          const q = await window.db.collection("clientes").where("email", "==", email).limit(1).get();
          if (!q.empty) {
            const cDoc = q.docs[0];
            const c = cDoc.data() || {};
            out.clienteId = cDoc.id;
            out.empresaId = out.empresaId || c.empresaId || c.empresa || null;
          }
        } catch (_) {}
      }
      if (!out.empresaId && out.clienteId) {
        try {
          const cSnap = await window.db.collection("clientes").doc(out.clienteId).get();
          if (cSnap.exists) {
            const c = cSnap.data() || {};
            out.empresaId = c.empresaId || c.empresa || null;
          }
        } catch (_) {}
      }
      return out;
    }

    if (!snap || !snap.exists) {
      try {
        const legacy = await window.db.collection("usuarios").doc(user.uid).get();
        if (legacy.exists) {
          const data = legacy.data() || {};
          return await completarVinculos({
            uid: user.uid,
            ...data,
            role: normalizeRole(data.rol || data.role),
            clienteId: data.clienteId || null,
            empresaId: data.empresaId || null
          });
        }
      } catch (_) {}
      return null;
    }

    const data = snap.data() || {};
    return await completarVinculos({
      uid: user.uid,
      ...data,
      role: normalizeRole(data.role),
      clienteId: data.clienteId || null,
      empresaId: data.empresaId || null
    });
  }

  function aplicarRestriccionesUI(perfil) {
    const role = normalizeRole(perfil?.role || "client");
    const currentRank = roleRank(role);

    document.querySelectorAll("[data-rol-min]").forEach((el) => {
      const min = normalizeRole(el.getAttribute("data-rol-min") || "admin");
      const ok = currentRank >= roleRank(min);
      el.style.display = ok ? "" : "none";
    });

    const elRol = document.getElementById("user-rol");
    if (elRol) elRol.textContent = role ? String(role).toUpperCase() : "";
  }

  window.DOMKA_ROLES = { roleRank, ROLE_ORDER, normalizeRole };
  window.cargarPerfil = cargarPerfil;
  window.aplicarRestriccionesUI = aplicarRestriccionesUI;
})();
