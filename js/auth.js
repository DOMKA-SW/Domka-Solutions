// js/auth.js
// Auth + routing. Requiere que `js/firebase.js` se cargue primero.
(() => {
  if (!window.firebase) {
    console.error("Firebase SDK no encontrado. Verifica los <script>.");
    return;
  }
  if (!window.auth || !window.db) {
    // `js/firebase.js` debería exponerlos, pero por compatibilidad lo intentamos aquí.
    try {
      window.auth = window.auth || window.firebase.auth();
      window.db = window.db || window.firebase.firestore();
    } catch (e) {
      console.error("No se pudo inicializar auth/db:", e);
      return;
    }
  }

  async function login() {
    const email = document.getElementById("email")?.value?.trim();
    const password = document.getElementById("password")?.value;
    if (!email || !password) {
      alert("Ingresa correo y contraseña.");
      return;
    }

    try {
      await window.auth.signInWithEmailAndPassword(email, password);
      const user = window.auth.currentUser;
      const target = window.DOMKA_SECURITY?.routeAfterLogin
        ? await window.DOMKA_SECURITY.routeAfterLogin(user)
        : (window.DOMKA_CONFIG?.ROUTES?.empresaHome || "/dashboard.html");

      window.location.href = target;
    } catch (error) {
      alert("Error en login: " + (error?.message || error));
    }
  }

  async function logout() {
    try {
      await window.auth.signOut();
      window.location.href = "/index.html";
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  }

  // Protección centralizada (si `js/security.js` está cargado)
  try {
    window.DOMKA_SECURITY?.protect?.();
  } catch (e) {
    console.warn("Protección no aplicada:", e);
  }

  window.login = login;
  window.logout = logout;
})();
