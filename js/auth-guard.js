// js/auth-guard.js — DOMKA Solutions (Firebase v8, compatible con tu stack)
// NO usa imports ES6. Funciona con window.firebase, window.auth, window.db

document.documentElement.style.visibility = 'hidden';

async function _waitForFirebase() {
  if (window.__domkaFirebaseReady) await window.__domkaFirebaseReady;
  for (let i = 0; i < 30; i++) {
    if (window.firebase && window.auth && window.db) return;
    await new Promise(r => setTimeout(r, 100));
  }
}

function _redirect(url) {
  if (window.location.pathname !== url) window.location.replace(url);
  else document.documentElement.style.visibility = 'visible';
}

window.guardRoute = async function(allowedRoles = [], loginUrl = '/login-empresa.html') {
  await _waitForFirebase();
  return new Promise((resolve) => {
    window.auth.onAuthStateChanged(async (user) => {
      if (!user) { _redirect(loginUrl); return; }
      try {
        const snap = await window.db.collection('users').doc(user.uid).get();
        if (!snap.exists) { await window.auth.signOut(); _redirect(loginUrl); return; }
        const profile = snap.data();
        if (!profile.activo) { await window.auth.signOut(); _redirect('/acceso-suspendido.html'); return; }
        if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
          _redirect('/403.html'); return;
        }
        document.documentElement.style.visibility = 'visible';
        resolve({ user, profile });
      } catch (err) {
        console.error('[auth-guard]', err);
        _redirect(loginUrl);
      }
    });
  });
};

window.guardStaff = async function(loginUrl = '/login-empresa.html') {
  const result = await window.guardRoute([], loginUrl);
  if (result?.profile?.role === 'client') { _redirect('/cliente/index.html'); return null; }
  return result;
};

window.guardCliente = async function(loginUrl = '/cliente/login.html') {
  return window.guardRoute(['client'], loginUrl);
};
