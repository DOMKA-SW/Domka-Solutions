import {
  db,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  getDoc
} from "./firebase-config.js";

async function createEmployee(payload) {
  return addDoc(collection(db, "employees"), payload);
}

async function listEmployees() {
  const snap = await getDocs(collection(db, "employees"));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function createPayroll(payload) {
  return addDoc(collection(db, "payroll"), payload);
}

async function listPayroll() {
  const snap = await getDocs(collection(db, "payroll"));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function createProject(payload) {
  return addDoc(collection(db, "projects"), payload);
}

async function listProjects() {
  const snap = await getDocs(collection(db, "projects"));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function assignClient(payload) {
  return addDoc(collection(db, "clients"), payload);
}

async function getClientByUid(uid) {
  const ref = query(collection(db, "clients"), where("uid", "==", uid));
  const snap = await getDocs(ref);
  if (!snap.empty) {
    const first = snap.docs[0];
    return { id: first.id, ...first.data() };
  }
  return null;
}

async function getProjectById(projectId) {
  const projectRef = doc(db, "projects", projectId);
  const snap = await getDoc(projectRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function updateProject(projectId, payload) {
  const projectRef = doc(db, "projects", projectId);
  return updateDoc(projectRef, payload);
}

async function getUserProfile(uid) {
  if (!uid) return null;
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export {
  createEmployee,
  listEmployees,
  createPayroll,
  listPayroll,
  createProject,
  listProjects,
  assignClient,
  getClientByUid,
  getProjectById,
  updateProject,
  getUserProfile
};
