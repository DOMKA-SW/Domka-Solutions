// firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyD8desCyfOvif4T3YciXj2RA6zozbfriF8",
  authDomain: "[domka-solutions.firebaseapp.com](http://domka-solutions.firebaseapp.com/)",
  projectId: "domka-solutions",
  storageBucket: "domka-solutions.firebasestorage.app",
  messagingSenderId: "698458465020",
  appId: "1:698458465020:web:4b9e841472bc3db0ba2d79"
};

// Inicializa Firebase en modo compat (coincide con los <script> del HTML)
firebase.initializeApp(firebaseConfig);

// Firestore y Auth (compat)
const db = firebase.firestore();
const auth = firebase.auth();

// Exponer globalmente
window.db = db;
window.auth = auth;

// URL pública del sitio (Vercel u otro): enlaces en Firestore y PDFs.
// Opcional: antes de cargar este script, define window.DOMKA_PUBLIC_BASE = "https://tu-proyecto.vercel.app"
(function () {
  var w = typeof window !== "undefined" ? window : null;
  if (!w) return;
  var origin =
    w.location && w.location.origin && w.location.protocol !== "file:"
      ? w.location.origin.replace(/\/$/, "")
      : "";
  w.DOMKA_PUBLIC_BASE = String(w.DOMKA_PUBLIC_BASE || origin).replace(/\/$/, "");
  w.domkaPublicUrl = function (path) {
    var base = w.DOMKA_PUBLIC_BASE || "";
    var p = path.charAt(0) === "/" ? path : "/" + path;
    return base + p;
  };
})();
