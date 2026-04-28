// js/security.js
// Proteccion de paginas basada en sesion + perfil (roles.js).
(() => {
  function pageName() {
    return window.location.pathname.split("/").pop() || "index.html";
  }

  function isInFolder(folderName) {
    return window.location.pathname.includes(`/${folderName}/`);
  }

  function isPublicPage() {
    const page = pageName();
    if (isInFolder("public")) return true;
    if (isInFolder("cliente") && page === "login.html") return true;
    return ["", "index.html", "home.html", "login-empresa.html"].includes(page);
  }

  function requireRole(perfil, allowed) {
    const role = perfil?.role || "client";
    return allowed.includes(role);
  }

  async function routeAfterLogin(user) {
    const perfil =
      typeof window.cargarPerfil === "function"
        ? await window.cargarPerfil(user).catch(() => null)
        : null;

    if (!perfil) return window.DOMKA_CONFIG?.ROUTES?.empresaHome || "/dashboard.html";
    if (perfil.role === "client") return window.DOMKA_CONFIG?.ROUTES?.clienteHome || "/cliente/index.html";
    return window.DOMKA_CONFIG?.ROUTES?.empresaHome || "/dashboard.html";
  }

  async function protect() {
    if (isPublicPage()) return;
    if (!window.auth || !window.auth.onAuthStateChanged) return;

    window.auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "/index.html";
        return;
      }

      const perfil =
        typeof window.cargarPerfil === "function"
          ? await window.cargarPerfil(user).catch(() => null)
          : null;

      if (isInFolder("cliente")) {
        if (!perfil || !requireRole(perfil, ["client"]) || !perfil.clienteId) {
          window.location.href = "/cliente/login.html";
          return;
        }
      }

      if (!isInFolder("cliente") && !isInFolder("public")) {
        if (perfil && perfil.role === "client") {
          window.location.href = window.DOMKA_CONFIG?.ROUTES?.clienteHome || "/cliente/index.html";
          return;
        }
      }

      if (typeof window.aplicarRestriccionesUI === "function") {
        window.aplicarRestriccionesUI(perfil);
      }
    });
  }

  window.DOMKA_SECURITY = { protect, routeAfterLogin };
})();
