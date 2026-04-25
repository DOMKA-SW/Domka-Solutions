// js/roles.js
// Helpers de roles/perfil en Firestore.
//
// Esquema esperado:
//   users/{uid} => { role: 'admin'|'comercial'|'finanzas'|'rrhh'|'client', clienteId?: string, nombre?: string }
//
// Nota: esto NO reemplaza reglas de Firestore; es solo UI + routing.
(() => {
  const ROLE_ORDER = ["client", "comercial", "finanzas", "rrhh", "admin"];

  function roleRank(role) {
    const idx = ROLE_ORDER.indexOf(role);
    return idx === -1 ? 0 : idx;
  }

  async function cargarPerfil(user) {
    if (!user) return null;
    if (!window.db) throw new Error("Firestore no inicializado (db).");

    const ref = window.db.collection("users").doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      // Bootstrap mínimo para staff (evita que el sistema quede “bloqueado” sin perfiles).
      // El rol real se administrará luego desde el módulo de usuarios / claims.
      const nombre = (user.displayName || user.email || "").split("@")[0] || "Usuario";
      const perfilBase = {
        email: user.email || "",
        nombre,
        role: "comercial",
        createdAt: window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || new Date()
      };
      await ref.set(perfilBase, { merge: true });
      return { uid: user.uid, ...perfilBase };
    }
    return { uid: user.uid, ...snap.data() };
  }

  function aplicarRestriccionesUI(perfil) {
    const rol = perfil?.role || "client";
    const currentRank = roleRank(rol);

    // Ocultar links que exigen un rol mínimo, usando data-rol-min
    document.querySelectorAll("[data-rol-min]").forEach((el) => {
      const min = el.getAttribute("data-rol-min") || "admin";
      const ok = currentRank >= roleRank(min);
      el.style.display = ok ? "" : "none";
    });

    const elRol = document.getElementById("user-rol");
    if (elRol) elRol.textContent = rol ? String(rol).toUpperCase() : "";
  }

  window.DOMKA_ROLES = { roleRank, ROLE_ORDER };
  window.cargarPerfil = cargarPerfil;
  window.aplicarRestriccionesUI = aplicarRestriccionesUI;
})();

