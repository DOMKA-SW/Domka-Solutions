// js/config.js
// Config centralizado para URLs/rutas. Mantener simple para hosting en Vercel.
(() => {
  const origin = window.location.origin;
  const vercelProd = "https://domka-solutions.vercel.app";

  // Base para links públicos que se comparten por WhatsApp
  // En Vercel normalmente será algo como https://tu-app.vercel.app
  const PUBLIC_BASE_URL = origin.includes("vercel.app") ? vercelProd : origin;

  // Rutas "lógicas" (sin framework)
  const ROUTES = {
    publicQuote: "/public/cotizacion.html",
    empresaHome: "/dashboard.html",
    clienteHome: "/cliente/index.html"
  };

  window.DOMKA_CONFIG = { PUBLIC_BASE_URL, ROUTES };
})();

