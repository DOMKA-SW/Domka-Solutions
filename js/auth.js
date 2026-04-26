// ═══════════════════════════════════════════════════════
//  DOMKA — Auth & Roles v4  (corregido)
// ═══════════════════════════════════════════════════════

(function () {
  const path     = window.location.pathname;
  const page     = path.split('/').pop() || 'index.html';
  const isPublic = ['', 'index.html', 'login-empresa.html', 'login-cliente.html'].includes(page)
                   || path.includes('/public/');
  const isCliente = path.includes('/cliente/');

  // ── ESTADO GLOBAL ─────────────────────────────────────
  window.DOMKA_ROL  = null;
  window.DOMKA_USER = null;

  // Evento que avisa a cada página que auth + rol ya cargaron
  function dispatchReady(ok) {
    window.dispatchEvent(new CustomEvent('domkaReady', { detail: { ok } }));
  }

  // ── BANNER DE SETUP (si Firestore niega acceso) ───────
  function mostrarBannerSetup() {
    if (document.getElementById('domka-setup-banner')) return;
    const b = document.createElement('div');
    b.id = 'domka-setup-banner';
    b.style.cssText = `
      position:fixed;top:0;left:0;right:0;z-index:9999;
      background:#92400e;color:#fff;
      padding:12px 24px;font-size:.86rem;font-family:'DM Sans',sans-serif;
      display:flex;align-items:center;justify-content:space-between;gap:16px;
    `;
    b.innerHTML = `
      <span>⚠️ <strong>Configuración pendiente:</strong> Las reglas de Firestore no están activas.
      Sigue la guía de instalación para activar el sistema.</span>
      <a href="PASO_A_PASO.html" target="_blank"
        style="background:#fff;color:#92400e;padding:6px 14px;border-radius:6px;font-weight:700;text-decoration:none;">
        Ver guía
      </a>
    `;
    document.body.prepend(b);
    // Ajustar sidebar para que no tape el banner
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) sidebar.style.top = '44px';
    const main = document.querySelector('.page-with-sidebar');
    if (main) main.style.paddingTop = '44px';
  }

  // ── FLUJO PRINCIPAL ───────────────────────────────────
  auth.onAuthStateChanged(async function (user) {

    // Páginas públicas → no hacer nada
    if (isPublic) return;

    // Sin usuario → redirigir al login correspondiente
    if (!user) {
      window.location.href = isCliente ? '../login-cliente.html' : 'login-empresa.html';
      return;
    }

    // ── Portal empresa ───────────────────────────────────
    if (!isCliente) {
      try {
        const snap = await db.collection('usuarios').doc(user.uid).get();

        if (!snap.exists) {
          // Usuario auth existe pero no tiene documento en Firestore
          // → puede ser el primer arranque o un error de config
          console.warn('[DOMKA] Usuario sin documento en colección usuarios:', user.uid);
          mostrarBannerSetup();
          dispatchReady(false);
          return;
        }

        const data = snap.data();

        if (!data.activo) {
          await auth.signOut();
          window.location.href = 'login-empresa.html';
          return;
        }

        // Guardar estado global
        window.DOMKA_ROL  = data.rol;
        window.DOMKA_USER = { ...data, uid: user.uid };

        // Actualizar UI sidebar
        const elNombre = document.getElementById('user-email');
        const elRol    = document.getElementById('user-rol');
        if (elNombre) elNombre.textContent = data.nombre || user.email;
        if (elRol)    elRol.textContent    = ROL_LABELS[data.rol] || data.rol;

        // Aplicar permisos de sidebar
        aplicarPermisos(data.rol);

        dispatchReady(true);

      } catch (err) {
        console.error('[DOMKA] Error leyendo colección usuarios:', err.code, err.message);

        if (err.code === 'permission-denied') {
          // Reglas no configuradas → mostrar aviso en lugar de hacer logout
          mostrarBannerSetup();
          dispatchReady(false);
        } else {
          // Otro error de red
          console.warn('[DOMKA] Error de red o Firestore no disponible');
          dispatchReady(false);
        }
      }
      return;
    }

    // ── Portal cliente ────────────────────────────────────
    // La verificación completa la hace cliente/index.html
    dispatchReady(true);
  });

  // ── PERMISOS POR ROL ──────────────────────────────────
  const ROL_LABELS = {
    admin:     'Administrador',
    comercial: 'Comercial',
    contador:  'Contador',
    rrhh:      'RRHH',
    operador:  'Operador'
  };

  const ROL_PERMISOS = {
    admin:     ['dashboard','cotizaciones','cuentas','clientes','proyectos','documentos','contabilidad','financiero','nomina','empleados','roles'],
    comercial: ['dashboard','cotizaciones','clientes','proyectos','documentos','cuentas'],
    contador:  ['dashboard','contabilidad','financiero','cuentas'],
    rrhh:      ['dashboard','nomina','empleados'],
    operador:  ['dashboard','proyectos','documentos']
  };

  function aplicarPermisos(rol) {
    const permitidos = ROL_PERMISOS[rol] || ['dashboard'];
    document.querySelectorAll('[data-modulo]').forEach(el => {
      if (!permitidos.includes(el.dataset.modulo)) {
        el.style.display = 'none';
      }
    });
  }

  // ── LOGOUT ────────────────────────────────────────────
  window.logout = function () {
    auth.signOut().then(() => {
      window.location.href = isCliente ? '../login-cliente.html' : 'login-empresa.html';
    });
  };

})();
