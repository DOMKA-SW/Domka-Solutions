// js/auth.js

// Inicializar Firebase solo si no está inicializado
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Inicializamos servicios
window.auth = firebase.auth();
window.db = firebase.firestore();

// --- LOGIN ---
function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  window.auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      window.location.href = "dashboard.html"; // al iniciar sesión
    })
    .catch((error) => {
      alert("Error en login: " + error.message);
    });
}

// --- LOGOUT ---
function logout() {
  window.auth.signOut()
    .then(() => {
      window.location.href = "home.html"; // al cerrar sesión
    })
    .catch((error) => {
      console.error("Error al cerrar sesión:", error);
    });
}

// --- PROTECCIÓN DE PÁGINAS PRIVADAS ---
window.auth.onAuthStateChanged(function(user) {
  const page = window.location.pathname.split("/").pop();

  // ✅ Solo estas páginas son públicas
  const publicPages = [
    "",              // ruta vacía → index.html por defecto en GitHub Pages
    "index.html",
    "home.html",
    "cotizacion.html",
    "cuenta.html"
  ];

  // Si estamos en /public → también es público
  if (publicPages.includes(page) || window.location.pathname.includes("/public/")) {
    return;
  }

  // Si no hay usuario en una página privada → mandar al home
  if (!user) {
    window.location.href = "home.html";
  }
});

// Exponer funciones en window
window.login = login;
window.logout = logout;
