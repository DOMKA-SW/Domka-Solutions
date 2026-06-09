// js/firebase.js — DOMKA v2 (carga paralela + caché offline)
(() => {
  const firebaseConfig = {
    apiKey: "AIzaSyD8desCyfOvif4T3YciXj2RA6zozbfriF8",
    authDomain: "domka-solutions.firebaseapp.com",
    projectId: "domka-solutions",
    storageBucket: "domka-solutions.firebasestorage.app",
    messagingSenderId: "698458465020",
    appId: "1:698458465020:web:4b9e841472bc3db0ba2d79"
  };

  const CDN      = "https://www.gstatic.com/firebasejs/8.10.0";
  const FALLBACK = "https://cdn.jsdelivr.net/npm/firebase@8.10.0";

  function alreadyLoaded(fragment) {
    return Array.from(document.scripts).some(s => (s.src || "").includes(fragment));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const key = src.split("/").pop();
      if (alreadyLoaded(key)) return resolve();
      const s = document.createElement("script");
      s.src   = src;
      s.async = false;
      s.onload  = resolve;
      s.onerror = () => reject(new Error(src));
      document.head.appendChild(s);
    });
  }

  async function tryLoad(base, file) {
    try   { await loadScript(`${base}/${file}`); return true; }
    catch { return false; }
  }

  function initGlobals() {
    if (!window.firebase) return false;
    const app = window.firebase.apps?.length
      ? window.firebase.app()
      : window.firebase.initializeApp(firebaseConfig);

    window.db   = app.firestore();
    window.auth = typeof app.auth === "function" ? app.auth() : null;

    // Caché local en IndexedDB — segunda carga es instantánea
    // Silencioso si el browser no soporta o si hay multiples tabs (modo incógnito falla gracefully)
    if (window.db) {
      window.db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    }
    return true;
  }

  async function ensureFirebase() {
    // 1) firebase-app es la base — debe ir primero
    const appOk = await tryLoad(CDN, "firebase-app-compat.js");
    if (!appOk) await tryLoad(FALLBACK, "firebase-app.js");

    // 2) auth + firestore en PARALELO (ahorra ~300-600ms por RTT eliminado)
    await Promise.allSettled([
      tryLoad(CDN, "firebase-auth-compat.js")
        .then(ok => ok || tryLoad(FALLBACK, "firebase-auth.js")),
      tryLoad(CDN, "firebase-firestore-compat.js")
        .then(ok => ok || tryLoad(FALLBACK, "firebase-firestore.js"))
    ]);

    // 3) Espera corta si el SDK aún no está en window (edge case timing)
    for (let i = 0; i < 8 && !window.firebase; i++) {
      await new Promise(r => setTimeout(r, 100));
    }

    return initGlobals();
  }

  window.__domkaFirebaseReady = ensureFirebase();
})();
