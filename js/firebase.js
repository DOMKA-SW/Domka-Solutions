// js/firebase.js
// ─────────────────────────────────────────────────────────────────
// NOTA DE SEGURIDAD: La API key de Firebase en aplicaciones web es
// INTENCIONALMENTE pública por diseño de Google. La seguridad real
// viene de las Firestore Security Rules y de restringir el dominio
// en Google Cloud Console → APIs → Credentials → HTTP referrers.
// Nunca guardar aquí tokens de servidor, service accounts ni secrets.
// ─────────────────────────────────────────────────────────────────
(() => {
  const firebaseConfig = {
    apiKey:            "AIzaSyD8desCyfOvif4T3YciXj2RA6zozbfriF8",
    authDomain:        "domka-solutions.firebaseapp.com",
    projectId:         "domka-solutions",
    storageBucket:     "domka-solutions.firebasestorage.app",
    messagingSenderId: "698458465020",
    appId:             "1:698458465020:web:4b9e841472bc3db0ba2d79"
  };

  if (!window.firebase) {
    // Error silencioso en producción — no revelar detalles internos
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      console.error("[DOMKA] Firebase SDK no fue cargado");
    }
    return;
  }

  const app = firebase.apps.length
    ? firebase.app()
    : firebase.initializeApp(firebaseConfig);

  window.db   = app.firestore();
  window.auth = app.auth();

  window.db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

  window.__domkaFirebaseReady = Promise.resolve();
  // Sin console.log en producción — no exponer estado interno
})();
