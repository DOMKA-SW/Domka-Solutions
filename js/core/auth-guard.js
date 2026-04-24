import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "./firebase-config.js";

function sanitizeText(value) {
  return String(value || "").replace(/[<>]/g, "").trim();
}

async function login(email, password) {
  const safeEmail = sanitizeText(email);
  const safePassword = sanitizeText(password);
  return signInWithEmailAndPassword(auth, safeEmail, safePassword);
}

function logout() {
  return signOut(auth);
}

function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export { login, logout, watchAuth, sanitizeText };
