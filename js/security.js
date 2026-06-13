// js/security.js
// Proteccion de paginas basada en sesion + perfil (roles.js).
(() => {
  // ── Ocultar inmediatamente para evitar flash de contenido ────────────────
  // Esto corre de forma síncrona al cargar el script, antes de cualquier async.
  (function hideImmediately() {
    const path = window.location.pathname;
    const page = path.split("/").pop() || "index.html";
    const isPublic =
      path.includes("/public/") ||
      (path.includes("/cliente/") && page === "login.html") ||
      ["", "index.html", "home.html", "login-empresa.html"].includes(page);
    if (!isPublic) {
      document.documentElement.style.visibility = "hidden";
    }
  })();

  // ── Suprimir logs en producción para no exponer info interna ─────────────
  (function guardConsole() {
    const isProd = location.hostname !== "localhost"
                && location.hostname !== "127.0.0.1"
                && !location.hostname.startsWith("192.168.");
    if (isProd) {
      const noop = () => {};
      ["log", "debug", "info"].forEach(m => { try { console[m] = noop; } catch(_) {} });
      // warn y error se mantienen para errores reales de Firebase/browser
    }
  })();
  // ── Mapa de roles permitidos por página ──────────────────────────────────
  // Si la página no aparece aquí, cualquier rol de empresa puede acceder.
  const PAGE_ROLES = {
    "dashboard.html":    ["admin","comercial","tecnico","contador","rrhh","finanzas"],
    "proyectos.html":    ["admin","comercial","tecnico"],
    "cotizaciones.html": ["admin","comercial"],
    "clientes.html":     ["admin","comercial"],
    "comercial.html":    ["admin","comercial"],
    "documentos.html":   ["admin","comercial"],
    "contabilidad.html": ["admin","contador","finanzas"],
    "usuarios.html":     ["admin","comercial"],
  };

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

    await window.__domkaFirebaseReady;
    
    if (isPublicPage()) return;
    document.documentElement.style.visibility = "hidden";
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

      // ── Portal cliente ───────────────────────────────────────────────────
      if (isInFolder("cliente")) {
        if (!perfil || !requireRole(perfil, ["client"]) || !perfil.clienteId) {
          window.location.href = "/cliente/login.html";
          return;
        }
      }

      // ── Portal empresa: un cliente no puede entrar nunca ─────────────────
      if (!isInFolder("cliente") && !isInFolder("public")) {
        if (perfil && perfil.role === "client") {
          window.location.href = window.DOMKA_CONFIG?.ROUTES?.clienteHome || "/cliente/index.html";
          return;
        }
      }

      // ── Guardia por página: verificar que el rol tenga acceso ─────────────
      // ⚠️  Solo aplica a páginas de empresa, NO al portal /cliente/
      // (pageName() devuelve el mismo nombre para /cotizaciones.html
      //  y /cliente/cotizaciones.html, por lo que hay que excluir el portal)
      const page = pageName();
      const allowedRoles = PAGE_ROLES[page];
      if (!isInFolder("cliente") && allowedRoles && perfil && !allowedRoles.includes(perfil.role)) {
        window.location.href = "/dashboard.html";
        return;
      }

      if (typeof window.aplicarRestriccionesUI === "function") {
        window.aplicarRestriccionesUI(perfil);
      }
      document.documentElement.style.visibility = "visible";
    });
  }

  window.DOMKA_SECURITY = { protect, routeAfterLogin, PAGE_ROLES };

  // ── Auto-ejecutar en cada página al cargar el script ─────────────────────
  // protect() ya maneja páginas públicas (sale inmediato) y páginas protegidas.
  protect();
})();
