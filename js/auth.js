// ═══════════════════════════════════════════════════════
//  DOMKA — Auth & Roles v5
//  Fix: bootstrap sin documento en usuarios
// ═══════════════════════════════════════════════════════

(function () {
  const path      = window.location.pathname;
  const page      = path.split('/').pop() || 'index.html';
  const isPublic  = ['', 'index.html', 'login-empresa.html', 'login-cliente.html', 'home.html'].includes(page)
                    || path.includes('/public/');
  const isCliente = path.includes('/cliente/');

  window.DOMKA_ROL  = null;
  window.DOMKA_USER = null;

  // ── Banner de error visible ────────────────────────
  function mostrarError(msg, linkTexto, linkHref) {
    if (document.getElementById('domka-err-banner')) return;
    const b = document.createElement('div');
    b.id = 'domka-err-banner';
    b.style.cssText = [
      'position:fixed;top:0;left:0;right:0;z-index:9999',
      'background:#7f1d1d;color:#fff',
      'padding:11px 20px;font-size:.84rem;font-family:sans-serif',
      'display:flex;align-items:center;justify-content:space-between;gap:12px'
    ].join(';');
    b.innerHTML = `<span>${msg}</span>` +
      (linkTexto ? `<a href="${linkHref}" style="background:#fff;color:#7f1d1d;padding:5px 12px;border-radius:5px;font-weight:700;text-decoration:none;white-space:nowrap">${linkTexto}</a>` : '');
    document.body.prepend(b);
  }

  // ── Dispatch evento rol listo ──────────────────────
  function ready(ok) {
    window.dispatchEvent(new CustomEvent('domkaReady', { detail: { ok } }));
  }

  // ── Actualizar sidebar ─────────────────────────────
  function setSidebarUser(data) {
    const el1 = document.getElementById('user-email');
    const el2 = document.getElementById('user-rol');
    const LABELS = { admin:'Administrador', comercial:'Comercial', contador:'Contador', rrhh:'RRHH', operador:'Operador' };
    if (el1) el1.textContent = data.nombre || data.email || '—';
    if (el2) el2.textContent = LABELS[data.rol] || data.rol || '—';
  }

  // ── Permisos sidebar ──────────────────────────────
  const ROL_PERMISOS = {
    admin:     ['dashboard','cotizaciones','cuentas','clientes','proyectos','documentos','contabilidad','financiero','nomina','empleados','roles'],
    comercial: ['dashboard','cotizaciones','clientes','proyectos','documentos','cuentas'],
    contador:  ['dashboard','contabilidad','financiero','cuentas'],
    rrhh:      ['dashboard','nomina','empleados'],
    operador:  ['dashboard','proyectos','documentos']
  };

  function aplicarPermisos(rol) {
    const ok = ROL_PERMISOS[rol] || ['dashboard'];
    document.querySelectorAll('[data-modulo]').forEach(el => {
      if (!ok.includes(el.dataset.modulo)) el.style.display = 'none';
    });
  }

  // ── AUTH PRINCIPAL ─────────────────────────────────
  auth.onAuthStateChanged(async function (user) {
    if (isPublic) return;

    if (!user) {
      window.location.href = isCliente ? '../login-cliente.html' : 'login-empresa.html';
      return;
    }

    if (isCliente) { ready(true); return; }

    // ── Portal Empresa: leer rol del usuario ──────────
    try {
      const snap = await db.collection('usuarios').doc(user.uid).get();

      if (!snap.exists) {
        // Usuario en Auth pero sin documento en Firestore
        mostrarError(
          '⚠️ Tu usuario no está registrado en el sistema. Pide al administrador que te agregue en Usuarios & Roles.',
          'Cerrar sesión',
          'javascript:auth.signOut().then(()=>location.href="login-empresa.html")'
        );
        ready(false);
        return;
      }

      const data = snap.data();

      if (!data.activo) {
        await auth.signOut();
        window.location.href = 'login-empresa.html';
        return;
      }

      window.DOMKA_ROL  = data.rol;
      window.DOMKA_USER = { ...data, uid: user.uid };

      setSidebarUser(data);
      aplicarPermisos(data.rol);
      ready(true);

    } catch (err) {
      console.error('[DOMKA Auth]', err.code, err.message);

      if (err.code === 'permission-denied') {
        mostrarError(
          '🔒 Error de permisos en Firestore. Verifica que las reglas estén publicadas y que exista el documento en la colección "usuarios".',
          'Ver guía',
          'PASO_A_PASO.html'
        );
      } else {
        mostrarError('⚠️ Error de conexión con Firebase. Verifica tus credenciales en js/firebase.js — projectId debe ser: <strong id="pid-hint"></strong>');
        // Mostrar projectId real del error para diagnóstico
        const hint = document.getElementById('pid-hint');
        if (hint) hint.textContent = err.message.includes('projects/') 
          ? err.message.match(/projects\/([^/]+)/)?.[1] || 'desconocido'
          : 'revisa firebase.js';
      }
      ready(false);
    }
  });

  // ── LOGOUT ────────────────────────────────────────
  window.logout = function () {
    auth.signOut().then(() => {
      window.location.href = isCliente ? '../login-cliente.html' : 'login-empresa.html';
    });
  };

})();
