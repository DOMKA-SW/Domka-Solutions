// js/firebase.js

(() => {
  const firebaseConfig = {
    apiKey: "AIzaSyD8desCyfOvif4T3YciXj2RA6zozbfriF8",
    authDomain: "domka-solutions.firebaseapp.com",
    projectId: "domka-solutions",
    storageBucket: "domka-solutions.firebasestorage.app",
    messagingSenderId: "698458465020",
    appId: "1:698458465020:web:4b9e841472bc3db0ba2d79"
  };

  if (!window.firebase) {
    console.error("Firebase SDK no fue cargado");
    return;
  }

  const app = firebase.apps.length
    ? firebase.app()
    : firebase.initializeApp(firebaseConfig);

  window.db = app.firestore();
  window.auth = app.auth();

  window.db.enablePersistence({
    synchronizeTabs: true
  }).catch(err => {
    console.warn("Firestore Persistence:", err);
  });

  window.__domkaFirebaseReady = Promise.resolve();

  console.log("Firebase listo");
})();
