import { login, logout, watchAuth, sanitizeText } from "../core/auth-guard.js";
import {
  createEmployee,
  listEmployees,
  createPayroll,
  listPayroll,
  createProject,
  listProjects,
  assignClient,
  getUserProfile
} from "../core/firestore-service.js";

const authBox = document.getElementById("auth-box");
const dashboardBox = document.getElementById("dashboard-box");
const moduleBox = document.getElementById("module-box");
const moduleTitle = document.getElementById("module-title");
const moduleContent = document.getElementById("module-content");
const dashboardSummary = document.getElementById("dashboard-summary");
let currentRole = null;

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

document.getElementById("btn-dashboard").addEventListener("click", renderDashboard);
document.getElementById("btn-empleados").addEventListener("click", renderEmployees);
document.getElementById("btn-nomina").addEventListener("click", renderPayroll);
document.getElementById("btn-proyectos").addEventListener("click", renderProjects);
document.getElementById("btn-clientes").addEventListener("click", renderClients);

watchAuth(async (user) => {
  const isLogged = Boolean(user);
  currentRole = null;
  authBox.hidden = isLogged;
  dashboardBox.hidden = !isLogged;
  moduleBox.hidden = !isLogged;
  if (isLogged) {
    const profile = await getUserProfile(user.uid);
    if (!profile || profile.role !== "admin") {
      alert("Tu usuario no tiene permisos de administrador.");
      await logout();
      return;
    }
    currentRole = profile.role;
    renderDashboard();
  }
});

async function renderDashboard() {
  if (currentRole !== "admin") return;
  moduleBox.hidden = true;
  const [employees, payroll, projects] = await Promise.all([
    listEmployees(),
    listPayroll(),
    listProjects()
  ]);
  dashboardSummary.textContent =
    `Empleados: ${employees.length} | Registros nomina: ${payroll.length} | Proyectos: ${projects.length}`;
}

async function renderEmployees() {
  if (currentRole !== "admin") return;
  moduleBox.hidden = false;
  moduleTitle.textContent = "Gestion de Empleados";
  const employees = await listEmployees();
  moduleContent.innerHTML = `
    <div class="card">
      <div class="form-grid">
        <input id="emp-name" placeholder="Nombre empleado" />
        <input id="emp-role" placeholder="Cargo" />
        <input id="emp-salary" placeholder="Salario base" type="number" />
      </div>
      <button class="btn" id="save-employee">Guardar empleado</button>
    </div>
    <table>
      <thead><tr><th>Nombre</th><th>Cargo</th><th>Salario</th></tr></thead>
      <tbody>${employees.map((e) => `<tr><td>${e.name || ""}</td><td>${e.role || ""}</td><td>${e.salary || 0}</td></tr>`).join("")}</tbody>
    </table>
  `;
  document.getElementById("save-employee").addEventListener("click", async () => {
    const payload = {
      name: sanitizeText(document.getElementById("emp-name").value),
      role: sanitizeText(document.getElementById("emp-role").value),
      salary: Number(document.getElementById("emp-salary").value || 0),
      createdAt: Date.now()
    };
    await createEmployee(payload);
    renderEmployees();
  });
}

async function renderPayroll() {
  if (currentRole !== "admin") return;
  moduleBox.hidden = false;
  moduleTitle.textContent = "Gestion de Nomina";
  const [payroll, employees] = await Promise.all([listPayroll(), listEmployees()]);
  const options = employees.map((e) => `<option value="${e.id}">${e.name}</option>`).join("");

  moduleContent.innerHTML = `
    <div class="card">
      <div class="form-grid">
        <select id="pay-employee">${options}</select>
        <input id="pay-days" type="number" placeholder="Dias trabajados" />
        <input id="pay-paid" type="number" placeholder="Pagos realizados" />
      </div>
      <button class="btn" id="save-payroll">Guardar nomina</button>
    </div>
    <table>
      <thead><tr><th>Empleado</th><th>Dias</th><th>Pago</th><th>PDF</th></tr></thead>
      <tbody>${payroll.map((p) => `<tr><td>${p.employeeId || ""}</td><td>${p.daysWorked || 0}</td><td>${p.paidAmount || 0}</td><td>${p.pdfUrl || "Pendiente"}</td></tr>`).join("")}</tbody>
    </table>
  `;

  document.getElementById("save-payroll").addEventListener("click", async () => {
    const daysWorked = Number(document.getElementById("pay-days").value || 0);
    const paidAmount = Number(document.getElementById("pay-paid").value || 0);
    const employeeId = sanitizeText(document.getElementById("pay-employee").value);
    await createPayroll({
      employeeId,
      daysWorked,
      paidAmount,
      pdfUrl: "",
      createdAt: Date.now()
    });
    renderPayroll();
  });
}

async function renderProjects() {
  if (currentRole !== "admin") return;
  moduleBox.hidden = false;
  moduleTitle.textContent = "Gestion de Proyectos";
  const projects = await listProjects();
  moduleContent.innerHTML = `
    <div class="card">
      <div class="form-grid">
        <input id="pro-name" placeholder="Nombre del proyecto" />
        <select id="pro-status">
          <option value="en curso">En curso</option>
          <option value="pausado">Pausado</option>
          <option value="terminado">Terminado</option>
        </select>
        <input id="pro-doc-link" placeholder="URL documento (opcional)" />
        <input id="pro-evidence-link" placeholder="URL evidencia (foto/video)" />
      </div>
      <button class="btn" id="save-project">Guardar proyecto</button>
    </div>
    <table>
      <thead><tr><th>Proyecto</th><th>Estado</th><th>Documento</th><th>Evidencia</th></tr></thead>
      <tbody>${projects.map((p) => `<tr><td>${p.name || ""}</td><td>${p.status || ""}</td><td>${p.documentUrl || ""}</td><td>${p.evidenceUrl || ""}</td></tr>`).join("")}</tbody>
    </table>
  `;
  document.getElementById("save-project").addEventListener("click", async () => {
    await createProject({
      name: sanitizeText(document.getElementById("pro-name").value),
      status: sanitizeText(document.getElementById("pro-status").value),
      documentUrl: sanitizeText(document.getElementById("pro-doc-link").value),
      evidenceUrl: sanitizeText(document.getElementById("pro-evidence-link").value),
      createdAt: Date.now()
    });
    renderProjects();
  });
}

async function renderClients() {
  if (currentRole !== "admin") return;
  moduleBox.hidden = false;
  moduleTitle.textContent = "Gestion de Clientes";
  const projects = await listProjects();
  const options = projects.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  moduleContent.innerHTML = `
    <div class="card">
      <div class="form-grid">
        <input id="client-name" placeholder="Nombre cliente" />
        <input id="client-uid" placeholder="UID Firebase Auth del cliente" />
        <select id="client-project-id">${options}</select>
      </div>
      <button class="btn" id="save-client">Asignar cliente</button>
      <p class="muted">Cada cliente se enlaza al proyecto para visualizar estado, documentos y evidencias sin duplicar archivos.</p>
    </div>
  `;
  document.getElementById("save-client").addEventListener("click", async () => {
    await assignClient({
      name: sanitizeText(document.getElementById("client-name").value),
      uid: sanitizeText(document.getElementById("client-uid").value),
      projectId: sanitizeText(document.getElementById("client-project-id").value),
      role: "client",
      createdAt: Date.now()
    });
    alert("Cliente asignado.");
  });
}
