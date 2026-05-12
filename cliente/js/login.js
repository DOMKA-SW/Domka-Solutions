// cliente/js/login.js
(() => {
  const msg = document.getElementById("msg");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const inviteEl = document.getElementById("inviteCode");
  const btnLogin = document.getElementById("btn-login");
  const btnRegister = document.getElementById("btn-register");
  const btnForgot = document.getElementById("btn-forgot");

  function show(type, text) {
    msg.className = `msg ${type}`;
    msg.textContent = text;
  }

  btnLogin.addEventListener("click", async () => {
    try {
      msg.className = "msg";
      await window.login();
    } catch (e) {
      show("err", e?.message || String(e));
    }
  });

  // ── Recuperar contraseña ──────────────────────────
  if (btnForgot) {
    btnForgot.addEventListener("click", async (e) => {
      e.preventDefault();
      const email = emailEl.value.trim();
      if (!email) {
        show("err", "Ingresa tu correo arriba para restablecer la contraseña.");
        return;
      }
      btnForgot.textContent = "Enviando…";
      try {
        await window.auth.sendPasswordResetEmail(email);
        show("ok", `✅ Correo de restablecimiento enviado a ${email}. Revisa tu bandeja de entrada.`);
      } catch(e) {
        if (e?.code === "auth/user-not-found") {
          show("err", "No encontramos una cuenta con ese correo.");
        } else {
          show("err", e?.message || String(e));
        }
      } finally {
        btnForgot.textContent = "¿Olvidaste tu contraseña?";
      }
    });
  }

  btnRegister.addEventListener("click", async () => {
    const email = emailEl.value.trim();
    const password = passEl.value;
    const code = inviteEl.value.trim().toUpperCase();
    if (!email || !password) return show("err", "Completa correo y contrasena.");
    if (!code) return show("err", "Pega el codigo de invitacion.");

    btnRegister.disabled = true;
    btnRegister.textContent = "Creando...";
    try {
      const invRef = window.db.collection("clientInvites").doc(code);
      const invSnap = await invRef.get();
      if (!invSnap.exists) throw new Error("Codigo invalido.");
      const inv = invSnap.data() || {};
      if (!inv.enabled) throw new Error("Codigo deshabilitado.");
      if (inv.claimedByUid) throw new Error("Este codigo ya fue usado.");

      try {
        await window.auth.createUserWithEmailAndPassword(email, password);
      } catch (err) {
        if (err?.code === "auth/email-already-in-use") {
          await window.auth.signInWithEmailAndPassword(email, password);
        } else {
          throw err;
        }
      }

      const user = window.auth.currentUser;
      if (!user) throw new Error("No se pudo iniciar sesion.");

      await invRef.update({
        claimedByUid: user.uid,
        claimedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });

      const profile = {
        email,
        role: "client",
        clienteId: inv.clienteId,
        empresaId: inv.empresaId || null,
        nombre: inv.clienteNombre || "Cliente",
        activo: true,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
      };
      await window.db.collection("users").doc(user.uid).set(profile, { merge: true });
      await window.db.collection("usuarios").doc(user.uid).set({
        email: profile.email,
        rol: "cliente",
        clienteId: profile.clienteId,
        empresaId: profile.empresaId,
        nombre: profile.nombre,
        activo: true,
        createdAt: profile.createdAt
      }, { merge: true });

      show("ok", "Cuenta vinculada correctamente. Entrando al portal...");
      window.location.href = "/cliente/index.html";
    } catch (e) {
      if (e?.code === "auth/email-already-in-use") {
        show("err", "Ese correo ya existe. Usa la misma contrasena para vincular el codigo.");
      } else if (e?.code === "auth/wrong-password") {
        show("err", "Ese correo ya existe pero la contrasena no coincide.");
      } else {
        show("err", e?.message || String(e));
      }
    } finally {
      btnRegister.disabled = false;
      btnRegister.textContent = "Crear cuenta y vincular";
    }
  });
})();

(() => {
  const msg = document.getElementById("msg");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const inviteEl = document.getElementById("inviteCode");
  const btnLogin = document.getElementById("btn-login");
  const btnRegister = document.getElementById("btn-register");

  function show(type, text) {
    msg.className = `msg ${type}`;
    msg.textContent = text;
  }

  btnLogin.addEventListener("click", async () => {
    try {
      msg.className = "msg";
      await window.login();
    } catch (e) {
      show("err", e?.message || String(e));
    }
  });

  btnRegister.addEventListener("click", async () => {
    const email = emailEl.value.trim();
    const password = passEl.value;
    const code = inviteEl.value.trim().toUpperCase();
    if (!email || !password) return show("err", "Completa correo y contrasena.");
    if (!code) return show("err", "Pega el codigo de invitacion.");

    btnRegister.disabled = true;
    btnRegister.textContent = "Creando...";
    try {
      const invRef = window.db.collection("clientInvites").doc(code);
      const invSnap = await invRef.get();
      if (!invSnap.exists) throw new Error("Codigo invalido.");
      const inv = invSnap.data() || {};
      if (!inv.enabled) throw new Error("Codigo deshabilitado.");
      if (inv.claimedByUid) throw new Error("Este codigo ya fue usado.");

      try {
        await window.auth.createUserWithEmailAndPassword(email, password);
      } catch (err) {
        if (err?.code === "auth/email-already-in-use") {
          await window.auth.signInWithEmailAndPassword(email, password);
        } else {
          throw err;
        }
      }

      const user = window.auth.currentUser;
      if (!user) throw new Error("No se pudo iniciar sesion.");

      await invRef.update({
        claimedByUid: user.uid,
        claimedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });

      const profile = {
        email,
        role: "client",
        clienteId: inv.clienteId,
        empresaId: inv.empresaId || null,
        nombre: inv.clienteNombre || "Cliente",
        activo: true,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
      };
      await window.db.collection("users").doc(user.uid).set(profile, { merge: true });
      await window.db.collection("usuarios").doc(user.uid).set({
        email: profile.email,
        rol: "cliente",
        clienteId: profile.clienteId,
        empresaId: profile.empresaId,
        nombre: profile.nombre,
        activo: true,
        createdAt: profile.createdAt
      }, { merge: true });

      show("ok", "Cuenta vinculada correctamente. Entrando al portal...");
      window.location.href = "/cliente/index.html";
    } catch (e) {
      if (e?.code === "auth/email-already-in-use") {
        show("err", "Ese correo ya existe. Usa la misma contrasena para vincular el codigo.");
      } else if (e?.code === "auth/wrong-password") {
        show("err", "Ese correo ya existe pero la contrasena no coincide.");
      } else {
        show("err", e?.message || String(e));
      }
    } finally {
      btnRegister.disabled = false;
      btnRegister.textContent = "Crear cuenta y vincular";
    }
  });
})();
