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

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((s) => s.src === src);
      if (existing) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
      document.head.appendChild(s);
    });
  }

  function setFirebaseGlobals(firebase) {
    const app = firebase.apps?.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
    const db = app.firestore();
    const auth = typeof app.auth === "function" ? app.auth() : null;
    window.db = db;
    window.auth = auth;
  }

  window.__domkaFirebaseReady = (async () => {
    if (window.firebase) {
      setFirebaseGlobals(window.firebase);
      return;
    }

    await loadScript("https://www.gstatic.com/firebasejs/8.10.0/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/8.10.0/firebase-auth-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/8.10.0/firebase-firestore-compat.js");

    if (!window.firebase) {
      throw new Error("Firebase SDK no disponible en esta pagina.");
    }
    setFirebaseGlobals(window.firebase);
  })().catch((err) => {
    console.error("[DOMKA Firebase]", err);
    window.__domkaFirebaseError = err;
  });
})();
