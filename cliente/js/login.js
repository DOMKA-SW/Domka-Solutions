// cliente/js/login.js
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
    if (!email || !password) return show("err", "Completa correo y contraseña.");
    if (!code) return show("err", "Pega el código de invitación.");

    btnRegister.disabled = true;
    btnRegister.textContent = "Creando…";
    try {
      // 1) validar invitación
      const invRef = window.db.collection("clientInvites").doc(code);
      const invSnap = await invRef.get();
      if (!invSnap.exists) throw new Error("Código inválido.");
      const inv = invSnap.data();
      if (!inv.enabled) throw new Error("Código deshabilitado.");
      if (inv.claimedByUid) throw new Error("Este código ya fue usado.");

      // 2) crear usuario auth (esto inicia sesión como el cliente)
      await window.auth.createUserWithEmailAndPassword(email, password);
      const user = window.auth.currentUser;
      if (!user) throw new Error("No se pudo iniciar sesión.");

      // 3) reclamar invitación (marcar claimed)
      await invRef.update({
        claimedByUid: user.uid,
        claimedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });

      // 4) crear perfil de usuario vinculado a cliente
      const profile = {
        email,
        role: "client",
        clienteId: inv.clienteId,
        nombre: inv.clienteNombre || "Cliente",
        activo: true,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
      };
      await window.db.collection("users").doc(user.uid).set(profile, { merge: true });
      await window.db.collection("usuarios").doc(user.uid).set({
        email: profile.email,
        rol: "cliente",
        clienteId: profile.clienteId,
        nombre: profile.nombre,
        activo: true,
        createdAt: profile.createdAt
      }, { merge: true });

      show("ok", "Cuenta creada y vinculada. Entrando al portal…");
      window.location.href = "/cliente/index.html";
    } catch (e) {
      show("err", e?.message || String(e));
    } finally {
      btnRegister.disabled = false;
      btnRegister.textContent = "Crear cuenta y vincular";
    }
  });
})();

