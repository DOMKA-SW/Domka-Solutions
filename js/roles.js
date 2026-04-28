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

    const ref = window.db.collection("users").doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) return null;

    const data = snap.data() || {};
    return {
      uid: user.uid,
      ...data,
      role: normalizeRole(data.role),
      clienteId: data.clienteId || null
    };
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
