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
