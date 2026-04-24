// js/public-cuenta.js
(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) {
    document.body.innerHTML = "<div class='p-6 text-center'>⚠️ Falta el parámetro <b>id</b> en la URL.</div>";
    return;
  }

  const elId = document.getElementById("cuenta-id");
  const elNombre = document.getElementById("cliente-nombre");
  const elContacto = document.getElementById("cliente-contacto");
  const elFecha = document.getElementById("cuenta-fecha");
  const elEstado = document.getElementById("cuenta-estado");
  const elItems = document.getElementById("detalle-items");
  const elSub = document.getElementById("subtotal");
  const elTot = document.getElementById("total");
  const elNotas = document.getElementById("notas");
  //const elTerminos = document.getElementById("terminos");

  elId.textContent = `ID: ${id}`;

  db.collection("cuentas").doc(id).get().then(async (docu) => {
    if (!docu.exists) {
      document.body.innerHTML = "<div class='p-6 text-center'>❌ Cuenta de cobro no encontrada.</div>";
      return;
    }
    const c = docu.data() || {};

    // Cliente
    let nombre = "(sin nombre)";
    let contacto = "";
    if (c.clienteId) {
      const cli = await db.collection("clientes").doc(c.clienteId).get();
      const cd = cli.data() || {};
      nombre = cd.nombreEmpresa || cd.nombre || nombre;
      const tel = cd.telefono ? `Tel: ${cd.telefono}` : "";
      const mail = cd.email ? ` | Email: ${cd.email}` : "";
      contacto = (tel || mail) ? (tel + mail) : "";
    }
    elNombre.textContent = nombre;
    elContacto.textContent = contacto;

    // Cabecera
    elFecha.textContent = c.fecha?.toDate ? c.fecha.toDate().toLocaleDateString() : new Date(c.fecha).toLocaleDateString();
    elEstado.textContent = c.estado || "pendiente";
    elEstado.className = `inline-block mt-2 px-2 py-1 rounded text-xs ${c.estado === "pagada" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`;

    // 🔹 Mostrar "Debe a" y "Por concepto de"
    if (c.concepto) {
      const conceptoEl = document.createElement("div");
      conceptoEl.className = "my-4";
      conceptoEl.innerHTML = `
        <p class="font-semibold">Debe a:</p>
        <p>Alexander Otalora Camayo</p>
        <p class="font-semibold mt-2">Por concepto de:</p>
        <p>${c.concepto}</p>
      `;
      elNombre.parentNode.appendChild(conceptoEl);
    }

    // Items
    elItems.innerHTML = "";
    if (Array.isArray(c.items) && c.items.length > 0) {
      c.items.forEach(it => {
        const tr = document.createElement("tr");
        tr.className = "border-t";

        // Ocultar columnas si es modo valor total
        const cantidadStyle = c.tipoCalculo === "valor-total" ? "hidden" : "";
        const precioStyle = c.tipoCalculo === "valor-total" ? "hidden" : "";
        const subtotalStyle = c.tipoCalculo === "valor-total" ? "hidden" : "";

        tr.innerHTML = `
          <td class="p-2">${it.descripcion || ""}</td>
          <td class="p-2 text-right ${cantidadStyle}">${Number(it.cantidad || 0)}</td>
          <td class="p-2 text-right ${precioStyle}">$${Number(it.precio || 0).toLocaleString("es-CO")}</td>
          <td class="p-2 text-right ${subtotalStyle}">$${Number(it.subtotal || 0).toLocaleString("es-CO")}</td>
        `;
        elItems.appendChild(tr);
      });
    } else {
      elItems.innerHTML = `<tr><td colspan="4" class="p-2 text-center text-gray-500">Sin actividades registradas</td></tr>`;
    }

    // Ocultar encabezados de columnas si es modo valor total
    if (c.tipoCalculo === "valor-total") {
      const headers = document.querySelectorAll("#detalle-items th");
      if (headers.length >= 4) {
        headers[1].classList.add("hidden");
        headers[2].classList.add("hidden");
        headers[3].classList.add("hidden");
      }
    }

    // Totales + notas
    elSub.textContent = `Subtotal: $${Number(c.subtotal || 0).toLocaleString("es-CO")}`;
    elTot.textContent = `Total: $${Number(c.total || 0).toLocaleString("es-CO")}`;
    elNotas.textContent = c.notas || "—";
    //elTerminos.textContent = c.terminos || "—";

    // Valor en letras si está habilitado
    if (c.mostrarValorLetras && typeof numeroAPalabras === 'function') {
      const valorLetrasEl = document.createElement("p");
      valorLetrasEl.className = "text-sm italic mt-1 text-gray-600";
      valorLetrasEl.textContent = `Son: ${numeroAPalabras(c.total || 0)}`;
      elTot.parentNode.appendChild(valorLetrasEl);
    }

  }).catch(err => {
    console.error(err);
    document.body.innerHTML = "<div class='p-6 text-center'>⚠️ Error cargando la cuenta de cobro.</div>";
  });
})();
