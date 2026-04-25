// js/clientes.js
const formClientes = document.getElementById("form-clientes");
const listaClientes = document.getElementById("clientes-list");

let editando = false;
let idEditando = null;

// Invite UI
const btnGenerarInvite = document.getElementById("btn-generar-invite");
const inviteBox = document.getElementById("invite-box");
const inviteCodeEl = document.getElementById("invite-code");
const btnCopiarInvite = document.getElementById("btn-copiar-invite");

// ── Guardar cliente ───────────────────────────────────────
formClientes.addEventListener("submit", async (e) => {
  e.preventDefault();

  const tipoId  = formClientes.tipoIdentificacion.value;
  const numId   = formClientes.identificacion.value.trim();

  const cliente = {
    nombre:             formClientes.nombre.value.trim(),
    email:              formClientes.email.value.trim(),
    telefono:           formClientes.telefono.value.trim(),
    empresa:            formClientes.empresa.value.trim(),
    tipoIdentificacion: tipoId,
    identificacion:     numId,
    // Campos legacy para compatibilidad con documentos existentes en Firebase
    nit:                tipoId === "NIT" ? numId : "",
    numeroDocumento:    tipoId !== "NIT" ? numId : "",
  };

  if (editando) {
    await db.collection("clientes").doc(idEditando).update(cliente);
    editando = false;
    idEditando = null;
    formClientes.querySelector("button[type=submit]").textContent = "Guardar Cliente";
  } else {
    await db.collection("clientes").add(cliente);
  }

  formClientes.reset();
  cargarClientes();
});

// ── Cargar clientes ───────────────────────────────────────
async function cargarClientes() {
  const snapshot = await db.collection("clientes").get();
  listaClientes.innerHTML = "";
  let count = 0;

  snapshot.forEach((doc) => {
    const c = doc.data();
    count++;

    const idLabel = c.tipoIdentificacion || (c.nit ? "NIT" : c.numeroDocumento ? "Doc" : "");
    const idValor = c.identificacion || c.nit || c.numeroDocumento || "—";
    const idTexto = idLabel ? `${idLabel}: ${idValor}` : idValor;

    listaClientes.innerHTML += `
      <tr class="border-b table-row-striped">
        <td class="p-2">${c.nombre || "—"}</td>
        <td class="p-2">${c.email || "—"}</td>
        <td class="p-2">${c.telefono || "—"}</td>
        <td class="p-2">${c.empresa || "—"}</td>
        <td class="p-2" style="font-size:.82rem;color:var(--gray)">${idTexto}</td>
        <td class="p-2 space-x-2">
          <button onclick="editarCliente('${doc.id}')" class="action-btn action-btn-edit">Editar</button>
          <button onclick="eliminarCliente('${doc.id}')" class="action-btn action-btn-delete">Eliminar</button>
        </td>
      </tr>
    `;
  });

  const contador = document.getElementById("clientes-count");
  if (contador) contador.textContent = `${count} cliente${count !== 1 ? "s" : ""}`;

  const emptyState = document.getElementById("empty-state");
  if (emptyState) emptyState.style.display = count === 0 ? "block" : "none";
}

// ── Eliminar cliente ──────────────────────────────────────
async function eliminarCliente(id) {
  if (confirm("¿Seguro de eliminar este cliente?")) {
    await db.collection("clientes").doc(id).delete();
    cargarClientes();
  }
}

// ── Editar cliente ────────────────────────────────────────
async function editarCliente(id) {
  const docSnap = await db.collection("clientes").doc(id).get();
  const c = docSnap.data();

  formClientes.nombre.value   = c.nombre   || "";
  formClientes.email.value    = c.email    || "";
  formClientes.telefono.value = c.telefono || "";
  formClientes.empresa.value  = c.empresa  || "";

  const tipoLegacy = c.nit ? "NIT" : "CC";
  formClientes.tipoIdentificacion.value = c.tipoIdentificacion || tipoLegacy;
  formClientes.identificacion.value     = c.identificacion || c.nit || c.numeroDocumento || "";

  editando    = true;
  idEditando  = id;

  formClientes.querySelector("button[type=submit]").textContent = "Actualizar Cliente";
  formClientes.scrollIntoView({ behavior: "smooth" });
}

cargarClientes();

window.eliminarCliente = eliminarCliente;
window.editarCliente   = editarCliente;

function makeInviteCode() {
  // 10 chars, legible
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function generarInviteParaCliente(clienteId, clienteData) {
  if (!clienteId) throw new Error("Selecciona/guarda un cliente primero.");
  const code = makeInviteCode();
  const ref = db.collection("clientInvites").doc(code);
  await ref.set({
    code,
    clienteId,
    clienteNombre: clienteData?.nombre || clienteData?.empresa || "Cliente",
    enabled: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    claimedByUid: null,
    claimedAt: null
  });
  await db.collection("clientes").doc(clienteId).set({ portalInviteCode: code }, { merge: true });
  return code;
}

async function obtenerClienteActualForm() {
  // Si estamos editando, usamos ese ID; si no, intentamos buscar por email exacto.
  if (editando && idEditando) {
    const snap = await db.collection("clientes").doc(idEditando).get();
    return { id: idEditando, data: snap.data() || {} };
  }

  const email = formClientes.email.value.trim();
  if (!email) return null;
  const snap = await db.collection("clientes").where("email", "==", email).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return null;
  return { id: doc.id, data: doc.data() || {} };
}

if (btnGenerarInvite) {
  btnGenerarInvite.addEventListener("click", async () => {
    try {
      const current = await obtenerClienteActualForm();
      if (!current?.id) {
        alert("Primero guarda el cliente (o edítalo) para generar el código.");
        return;
      }
      const code = await generarInviteParaCliente(current.id, current.data);
      if (inviteCodeEl) inviteCodeEl.textContent = code;
      if (inviteBox) inviteBox.classList.remove("hidden");
    } catch (e) {
      alert("No se pudo generar el código: " + (e?.message || e));
    }
  });
}

if (btnCopiarInvite) {
  btnCopiarInvite.addEventListener("click", async () => {
    const code = inviteCodeEl?.textContent?.trim();
    if (!code || code === "—") return;
    try {
      await navigator.clipboard.writeText(code);
      btnCopiarInvite.textContent = "Copiado";
      setTimeout(() => (btnCopiarInvite.textContent = "Copiar"), 1200);
    } catch {
      alert("Copia manualmente el código: " + code);
    }
  });
}
