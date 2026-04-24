import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD8desCyfOvif4T3YciXj2RA6zozbfriF8",
  authDomain: "domka-solutions.firebaseapp.com",
  projectId: "domka-solutions",
  storageBucket: "domka-solutions.firebasestorage.app",
  messagingSenderId: "698458465020",
  appId: "1:698458465020:web:4b9e841472bc3db0ba2d79"
};

const hasPlaceholders = Object.values(firebaseConfig).some((value) =>
  String(value).startsWith("REEMPLAZAR_")
);

if (hasPlaceholders) {
  throw new Error(
    "Debes configurar las credenciales Firebase en js/core/firebase-config.js antes de usar la aplicacion."
  );
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  getDoc
};
