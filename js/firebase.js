// js/firebase.js
(() => {
  if (!window.firebase) {
    throw new Error("Firebase SDK no cargado. Verifica los scripts firebase-*-compat.js en el HTML.");
  }

  const firebaseConfig = {
    apiKey: "AIzaSyD8desCyfOvif4T3YciXj2RA6zozbfriF8",
    authDomain: "domka-solutions.firebaseapp.com",
    projectId: "domka-solutions",
    storageBucket: "domka-solutions.firebasestorage.app",
    messagingSenderId: "698458465020",
    appId: "1:698458465020:web:4b9e841472bc3db0ba2d79"
  };

  const app = window.firebase.apps?.length
    ? window.firebase.app()
    : window.firebase.initializeApp(firebaseConfig);

  const db = app.firestore();
  const auth = typeof app.auth === "function" ? app.auth() : null;

  window.db = db;
  window.auth = auth;
})();
