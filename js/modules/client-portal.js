import { login, logout, watchAuth } from "../core/auth-guard.js";
import { getClientByUid, getProjectById, getUserProfile } from "../core/firestore-service.js";

const authBox = document.getElementById("auth-box");
const clientBox = document.getElementById("client-box");
const clientContent = document.getElementById("client-content");

document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await login(email, password);
  } catch (error) {
    alert("No fue posible iniciar sesion: " + error.message);
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  await logout();
});

document.getElementById("btn-mi-proyecto").addEventListener("click", async () => {
  const user = window.__CURRENT_USER__;
  if (!user) return;
  await renderProjectData(user.uid, "project");
});

document.getElementById("btn-documentos").addEventListener("click", async () => {
  const user = window.__CURRENT_USER__;
  if (!user) return;
  await renderProjectData(user.uid, "documents");
});

document.getElementById("btn-evidencias").addEventListener("click", async () => {
  const user = window.__CURRENT_USER__;
  if (!user) return;
  await renderProjectData(user.uid, "evidences");
});

watchAuth(async (user) => {
  window.__CURRENT_USER__ = user || null;
  authBox.hidden = Boolean(user);
  clientBox.hidden = !user;
  if (user) {
    const profile = await getUserProfile(user.uid);
    if (!profile || profile.role !== "client") {
      alert("Tu usuario no tiene permisos de cliente.");
      await logout();
      return;
    }
    await renderProjectData(user.uid, "project");
  }
});

async function renderProjectData(uid, viewType) {
  const client = await getClientByUid(uid);
  if (!client) {
    clientContent.innerHTML = "<p class='muted'>No hay un proyecto asignado para este usuario.</p>";
    return;
  }

  const project = await getProjectById(client.projectId);
  if (!project) {
    clientContent.innerHTML = "<p class='muted'>Proyecto no encontrado.</p>";
    return;
  }

  if (viewType === "project") {
    clientContent.innerHTML = `
      <div class="card">
        <h4>${project.name || "Proyecto sin nombre"}</h4>
        <p><strong>Estado:</strong> ${project.status || "sin estado"}</p>
      </div>
    `;
    return;
  }

  if (viewType === "documents") {
    clientContent.innerHTML = `
      <div class="card">
        <h4>Documentos del proyecto</h4>
        <p>${project.documentUrl ? `<a href="${project.documentUrl}" target="_blank" rel="noreferrer">Abrir documento</a>` : "Sin documento registrado"}</p>
      </div>
    `;
    return;
  }

  clientContent.innerHTML = `
    <div class="card">
      <h4>Evidencias del proyecto</h4>
      <p>${project.evidenceUrl ? `<a href="${project.evidenceUrl}" target="_blank" rel="noreferrer">Abrir evidencia</a>` : "Sin evidencia registrada"}</p>
    </div>
  `;
}
