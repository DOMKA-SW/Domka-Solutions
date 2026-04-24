// firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyAzcLdb3lm0efSMuG3U3U8etdb9oJe9SdY",
  authDomain: "domka-cotizador.firebaseapp.com",
  projectId: "domka-cotizador",
  storageBucket: "domka-cotizador.firebasestorage.app",
  messagingSenderId: "11233894590",
  appId: "1:11233894590:web:56fb76f5a1ca9af7453eef"
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
