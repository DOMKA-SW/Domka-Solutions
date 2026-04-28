// js/auth.js
// Auth central para portal empresa y portal cliente.
(() => {
  const path = window.location.pathname || "/";
  const page = path.split("/").pop() || "index.html";
  const isClienteArea = path.includes("/cliente/");
  const isPublicPage =
    path.includes("/public/") ||
    ["", "index.html", "home.html", "login.html", "login-empresa.html"].includes(page) ||
    path.endsWith("/cliente/login.html");

  function empresaLoginUrl() {
    return "/login-empresa.html";
  }

  function clienteLoginUrl() {
    return "/cliente/login.html";
  }

  function normalizeRole(role) {
    const input = String(role || "").toLowerCase().trim();
    if (input === "cliente") return "client";
    if (input === "operador") return "tecnico";
    return input || "client";
  }

  function setLoginError(message) {
    try {
      sessionStorage.setItem("domka_login_error", message || "");
    } catch (_) {}
  }

  function paintLoginErrorIfAny() {
    try {
      const text = sessionStorage.getItem("domka_login_error");
      if (!text) return;
      sessionStorage.removeItem("domka_login_error");
      const errorEl = document.getElementById("error-msg");
      const msgEl = document.getElementById("msg");
      if (errorEl) {
        errorEl.style.display = "block";
        errorEl.textContent = text;
      }
      if (msgEl) {
        msgEl.className = "msg err";
        msgEl.textContent = text;
      }
    } catch (_) {}
  }

  async function getPerfil(user) {
    if (!user || !window.db) return null;

    const usersSnap = await window.db.collection("users").doc(user.uid).get();
    if (usersSnap.exists) {
      const data = usersSnap.data() || {};
      return {
        uid: user.uid,
        email: data.email || user.email || "",
        nombre: data.nombre || "",
        role: normalizeRole(data.role || "comercial"),
        activo: data.activo !== false,
        clienteId: data.clienteId || null
      };
    }

    // Compatibilidad con esquema antiguo
    const legacySnap = await window.db.collection("usuarios").doc(user.uid).get();
    if (legacySnap.exists) {
      const data = legacySnap.data() || {};
      return {
        uid: user.uid,
        email: data.email || user.email || "",
        nombre: data.nombre || "",
        role: normalizeRole(data.rol || "comercial"),
        activo: data.activo !== false,
        clienteId: data.clienteId || null
      };
    }

    return null;
  }

  async function routeUser(user) {
    let perfil = null;
    try {
      perfil =
        (typeof window.cargarPerfil === "function" && (await window.cargarPerfil(user).catch(() => null))) ||
        (await getPerfil(user));
    } catch (err) {
      const msg = String(err?.message || "");
      const code = String(err?.code || "");
      if (code.includes("permission-denied") || msg.toLowerCase().includes("permission")) {
        setLoginError("Firestore denego lectura del perfil. Publica las reglas nuevas y verifica coleccion users.");
      } else {
        setLoginError("No se pudo leer tu perfil en Firestore. Revisa configuracion del proyecto.");
      }
      await window.auth.signOut().catch(() => {});
      window.location.href = empresaLoginUrl();
      return;
    }

    if (!perfil || perfil.activo === false) {
      setLoginError(!perfil
        ? "Tu usuario existe en Authentication pero no tiene perfil en Firestore (users/{uid})."
        : "Tu usuario esta inactivo. Contacta al administrador.");
      await window.auth.signOut().catch(() => {});
      window.location.href = empresaLoginUrl();
      return;
    }

    if (perfil && perfil.role === "client") {
      window.location.href = window.DOMKA_CONFIG?.ROUTES?.clienteHome || "/cliente/index.html";
      return;
    }

    window.location.href = window.DOMKA_CONFIG?.ROUTES?.empresaHome || "/dashboard.html";
  }

  async function login() {
    const emailEl = document.getElementById("email");
    const passEl = document.getElementById("password");
    const errorEl = document.getElementById("error-msg");
    const msgEl = document.getElementById("msg");
    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";

    if (!email || !password) {
      const text = "Completa correo y contraseña.";
      if (errorEl) {
        errorEl.style.display = "block";
        errorEl.textContent = text;
      }
      if (msgEl) {
        msgEl.className = "msg err";
        msgEl.textContent = text;
      }
      throw new Error(text);
    }

    if (errorEl) errorEl.style.display = "none";
    if (msgEl) msgEl.className = "msg";

    try {
      await window.auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      let text = "No se pudo iniciar sesion.";
      if (err?.code === "auth/wrong-password" || err?.code === "auth/user-not-found" || err?.message?.includes("INVALID_LOGIN_CREDENTIALS")) {
        text = "Credenciales invalidas. Verifica correo y contrasena.";
      } else if (err?.code === "auth/invalid-email") {
        text = "Correo invalido.";
      } else if (err?.code === "auth/too-many-requests") {
        text = "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
      }

      if (errorEl) {
        errorEl.style.display = "block";
        errorEl.textContent = text;
      }
      if (msgEl) {
        msgEl.className = "msg err";
        msgEl.textContent = text;
      }
      throw new Error(text);
    }

    const user = window.auth.currentUser;
    if (!user) throw new Error("No se pudo iniciar sesión.");
    await routeUser(user);
  }

  window.login = login;
  window.logout = function logout() {
    window.auth.signOut().then(() => {
      window.location.href = isClienteArea ? clienteLoginUrl() : empresaLoginUrl();
    });
  };

  if (isPublicPage) paintLoginErrorIfAny();

  if (!isPublicPage && window.auth?.onAuthStateChanged) {
    window.auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = isClienteArea ? clienteLoginUrl() : empresaLoginUrl();
        return;
      }

      let perfil = null;
      try {
        perfil =
          (typeof window.cargarPerfil === "function" && (await window.cargarPerfil(user).catch(() => null))) ||
          (await getPerfil(user));
      } catch (err) {
        const msg = String(err?.message || "");
        const code = String(err?.code || "");
        if (code.includes("permission-denied") || msg.toLowerCase().includes("permission")) {
          setLoginError("Firestore denego lectura del perfil. Publica las reglas nuevas y verifica coleccion users.");
        } else {
          setLoginError("No se pudo leer tu perfil en Firestore. Revisa configuracion del proyecto.");
        }
        await window.auth.signOut().catch(() => {});
        window.location.href = isClienteArea ? clienteLoginUrl() : empresaLoginUrl();
        return;
      }

      if (!perfil || perfil.activo === false) {
        setLoginError(!perfil
          ? "Tu usuario existe en Authentication pero no tiene perfil en Firestore (users/{uid})."
          : "Tu usuario esta inactivo. Contacta al administrador.");
        await window.auth.signOut().catch(() => {});
        window.location.href = isClienteArea ? clienteLoginUrl() : empresaLoginUrl();
        return;
      }

      // Portal cliente: exigir rol client y clienteId
      if (isClienteArea) {
        if (!perfil || perfil.role !== "client" || !perfil.clienteId) {
          window.location.href = clienteLoginUrl();
          return;
        }
      } else if (perfil && perfil.role === "client") {
        // Portal empresa: si entra un cliente, devolverlo a su portal
        window.location.href = window.DOMKA_CONFIG?.ROUTES?.clienteHome || "/cliente/index.html";
        return;
      }

      const sidebarName = document.getElementById("user-email");
      const sidebarRole = document.getElementById("user-rol");
      if (sidebarName) sidebarName.textContent = perfil?.nombre || perfil?.email || user.email || "Usuario";
      if (sidebarRole) sidebarRole.textContent = (perfil?.role || "").toUpperCase();
    });
  }
})();
