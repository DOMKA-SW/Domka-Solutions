// js/firebase.js
(() => {
  const firebaseConfig = {
    apiKey: "AIzaSyD8desCyfOvif4T3YciXj2RA6zozbfriF8",
    authDomain: "domka-solutions.firebaseapp.com",
    projectId: "domka-solutions",
    storageBucket: "domka-solutions.firebasestorage.app",
    messagingSenderId: "698458465020",
    appId: "1:698458465020:web:4b9e841472bc3db0ba2d79"
  };

  const FALLBACKS = [
    "https://www.gstatic.com/firebasejs/8.10.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/8.10.0/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/8.10.0/firebase-firestore-compat.js",
    "https://cdn.jsdelivr.net/npm/firebase@8.10.0/firebase-app.js",
    "https://cdn.jsdelivr.net/npm/firebase@8.10.0/firebase-auth.js",
    "https://cdn.jsdelivr.net/npm/firebase@8.10.0/firebase-firestore.js"
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const found = Array.from(document.scripts).some((s) => (s.src || "").includes(src));
      if (found) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
      document.head.appendChild(s);
    });
  }

  function setGlobals(firebase) {
    const app = firebase.apps?.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
    window.db = app.firestore();
    window.auth = typeof app.auth === "function" ? app.auth() : null;
  }

  async function ensureFirebase() {
    if (window.firebase) {
      setGlobals(window.firebase);
      return true;
    }

    for (const src of FALLBACKS) {
      try {
        await loadScript(src);
        if (window.firebase) {
          setGlobals(window.firebase);
          return true;
        }
      } catch (_) {}
    }

    // Retry corto para casos de carga tardía de script externo
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 150));
      if (window.firebase) {
        setGlobals(window.firebase);
        return true;
      }
    }

    console.error("[DOMKA Firebase] SDK no disponible tras reintentos.");
    return false;
  }

  window.__domkaFirebaseReady = ensureFirebase();
})();
