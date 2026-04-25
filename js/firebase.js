// firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyD8desCyfOvif4T3YciXj2RA6zozbfriF8",
  authDomain: "domka-solutions.firebaseapp.com",
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
