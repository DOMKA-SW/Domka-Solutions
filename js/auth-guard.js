import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app  = getApps().length ? getApps()[0] : initializeApp(window.__DOMKA_ENV__);
const auth = getAuth(app);
const db   = getFirestore(app);

// Oculta el contenido hasta verificar sesión (evita flash)
document.documentElement.style.visibility = 'hidden';

export async function guardRoute(allowedRoles = [], loginUrl = '/login-empresa.html') {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) { _redirect(loginUrl); return; }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) { await auth.signOut(); _redirect(loginUrl); return; }
        const profile = snap.data();
        if (!profile.activo) { await auth.signOut(); _redirect('/acceso-suspendido.html'); return; }
        if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
          _redirect('/403.html'); return;
        }
        document.documentElement.style.visibility = 'visible';
        resolve({ user, profile });
      } catch (e) {
        _redirect(loginUrl);
      }
    });
  });
}

export async function guardStaff(loginUrl = '/login-empresa.html') {
  const r = await guardRoute([], loginUrl);
  if (r?.profile?.role === 'client') { _redirect('/403.html'); return null; }
  return r;
}

export async function guardCliente(loginUrl = '/cliente/login.html') {
  return guardRoute(['client'], loginUrl);
}

function _redirect(url) {
  if (window.location.pathname !== url) window.location.replace(url);
  else document.documentElement.style.visibility = 'visible';
}

export { auth, db };
