// js/pdf-avance.js — DOMKA · Reporte de Avance de Obra (actividades)
// Misma línea gráfica que pdf-cotizacion.js: fondo beige, acento verde, todo en tablas.
// Requiere pdfmake + vfs_fonts cargados en la página (igual que cotizaciones.html).

async function _pdfAvanceImageToDataURL(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Error cargando logo:", err);
    return null;
  }
}

const PA = {
  bg: "#f4efe7", bgRow: "#ede7dc", black: "#1A1A1A", gray: "#5a5a5a",
  grayLight: "#9a9a9a", green: "#1b7a51", greenSoft: "#e8f4ee",
  amber: "#92600a", amberSoft: "#fdf1dc", red: "#991b1b", redSoft: "#fbe4e4",
  line: "#c8c0b4"
};

function paSLabel(text) {
  return { text, fontSize: 7.5, bold: true, color: PA.green, characterSpacing: 2, font: "Roboto", margin: [0, 0, 0, 7] };
}
function paHr(margin = [0, 14, 0, 12]) {
  return { canvas: [{ type: "line", x1: 0, y1: 0, x2: 507, y2: 0, lineWidth: 1, lineColor: PA.green }], margin };
}
function paCell(content, opts = {}) {
  return {
    font: "Roboto", fontSize: opts.fs || 9, bold: opts.bold || false, color: opts.color || PA.black,
    alignment: opts.align || "left", fillColor: opts.fill || PA.bg, border: [false, false, false, false],
    margin: opts.margin || [8, 7, 8, 7], text: content
  };
}
function paFmtDate(f) {
  if (!f) return "—";
  const d = new Date(f && f.seconds ? f.seconds * 1000 : f);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}
function paEstadoInfo(estado) {
  const map = {
    pendiente: { label: "Pendiente",   color: PA.gray,   fill: PA.bg },
    ejecutado: { label: "Por validar", color: PA.amber,  fill: PA.amberSoft },
    validado:  { label: "Validado",    color: PA.green,  fill: PA.greenSoft },
    objetado:  { label: "Objetado",    color: PA.red,    fill: PA.redSoft }
  };
  return map[estado] || map.pendiente;
}
function paEstadoDe(a) {
  if (a.estado) return a.estado;
  return a.hecho ? "validado" : "pendiente";
}

async function generarPDFAvance(proyecto, nombreClienteOverride) {
  const actividades = proyecto.actividades || [];
  if (!actividades.length) { alert("Este proyecto no tiene actividades registradas todavía."); return; }

  const images = { logo: await _pdfAvanceImageToDataURL("/img/logofondo.png").catch(() => null) };
  const nombreCliente = nombreClienteOverride || proyecto.nombreCliente || proyecto.clienteNombre || "—";
  const nombreProyecto = proyecto.nombre || proyecto.titulo || "Proyecto";

  const total = actividades.length;
  const validadas  = actividades.filter(a => paEstadoDe(a) === "validado").length;
  const ejecutadas = actividades.filter(a => paEstadoDe(a) === "ejecutado").length;
  const objetadas  = actividades.filter(a => paEstadoDe(a) === "objetado").length;
  const pctValidado = total ? Math.round((validadas / total) * 100) : 0;

  // Agrupar por categoría / fase
  const grupos = {};
  actividades.forEach(a => {
    const cat = a.categoria || "General";
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(a);
  });

  const bloqueHeader = {
    table: {
      widths: ["*", "auto"],
      body: [[
        {
          stack: [
            { text: "DOMKA", fontSize: 26, bold: true, color: PA.green, font: "Roboto" },
            { text: "Construcciónes", fontSize: 9, color: PA.gray, font: "Roboto", margin: [0, 2, 0, 0] },
            { text: `Fecha del reporte: ${paFmtDate(new Date())}`, fontSize: 8.5, color: PA.gray, margin: [0, 6, 0, 0] }
          ], fillColor: PA.bg, border: [false, false, false, false]
        },
        {
          stack: [
            { text: "Reporte de Avance de Obra", fontSize: 16, bold: true, color: PA.black, alignment: "right", font: "Roboto" },
            { text: nombreProyecto, fontSize: 10, color: PA.gray, alignment: "right", margin: [0, 4, 0, 0] }
          ], fillColor: PA.bg, border: [false, false, false, false]
        }
      ]]
    }, layout: "noBorders"
  };

  const bloqueInfo = {
    table: {
      widths: ["50%", "50%"],
      body: [[
        {
          stack: [
            paSLabel("CLIENTE"),
            { text: nombreCliente, fontSize: 12, bold: true, color: PA.black, margin: [0, 0, 0, 3] },
            ...(proyecto.direccion ? [{ text: proyecto.direccion, fontSize: 8.5, color: PA.gray }] : [])
          ], fillColor: PA.bg, border: [false, false, false, false], margin: [0, 10, 16, 10]
        },
        {
          stack: [
            paSLabel("AVANCE GENERAL"),
            { text: `${validadas} de ${total} actividades validadas (${pctValidado}%)`, fontSize: 10, color: PA.black, margin: [0, 0, 0, 3] },
            { text: `${ejecutadas} por validar · ${objetadas} objetadas`, fontSize: 8.5, color: PA.gray }
          ], fillColor: PA.bg, border: [false, false, false, false], margin: [16, 10, 0, 10]
        }
      ]]
    }, layout: "noBorders"
  };

  const bloquesGrupos = Object.entries(grupos).flatMap(([cat, items]) => {
    const validasCat = items.filter(a => paEstadoDe(a) === "validado").length;
    const rows = [[
      paCell("ACTIVIDAD", { bold: true, fs: 8, color: PA.grayLight, fill: PA.bgRow }),
      paCell("CANT.", { bold: true, fs: 8, color: PA.grayLight, fill: PA.bgRow, align: "right" }),
      paCell("UND", { bold: true, fs: 8, color: PA.grayLight, fill: PA.bgRow, align: "center" }),
      paCell("ESTADO", { bold: true, fs: 8, color: PA.grayLight, fill: PA.bgRow, align: "center" })
    ]];
    items.forEach(a => {
      const info = paEstadoInfo(paEstadoDe(a));
      rows.push([
        paCell(a.texto || "", {}),
        paCell(a.cantidad != null && a.cantidad !== "" ? String(a.cantidad) : "—", { align: "right" }),
        paCell(a.unidad || "—", { align: "center" }),
        paCell(info.label, { color: info.color, fill: info.fill, bold: true, fs: 8.5, align: "center" })
      ]);
    });
    return [
      { text: `${cat.toUpperCase()}  ·  ${validasCat}/${items.length} validadas`, fontSize: 9, bold: true, color: PA.green, margin: [0, 14, 0, 6] },
      {
        table: { widths: ["*", 42, 34, 78], body: rows },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => PA.line }
      }
    ];
  });

  const bloqueFirma = {
    margin: [0, 22, 0, 0],
    table: {
      widths: ["*"],
      body: [[
        {
          stack: [
            paSLabel("VALIDACIÓN DEL CLIENTE"),
            {
              text: pctValidado === 100
                ? "Todas las actividades registradas fueron validadas por el cliente a través del portal DOMKA."
                : "Este reporte refleja el estado de validación al momento de su generación. Las actividades marcadas como “Por validar” u “Objetado” aún requieren confirmación del cliente en el portal.",
              fontSize: 8.5, color: PA.gray, italics: true
            }
          ], fillColor: PA.bg, border: [false, false, false, false], margin: [0, 10, 0, 10]
        }
      ]]
    }, layout: "noBorders"
  };

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [44, 44, 44, 48],
    background: (currentPage, pageSize) => ([
      { canvas: [{ type: "rect", x: 0, y: 0, w: pageSize.width, h: pageSize.height, color: PA.bg }] },
      ...(images.logo ? [{
        image: images.logo, width: 240, opacity: 0.035,
        absolutePosition: { x: (pageSize.width - 240) / 2, y: (pageSize.height - 240) / 2 }
      }] : [])
    ]),
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: "DOMKA CONSTRUCCIONES S.A.S. · NIT 902.083.143-2", fontSize: 7, color: PA.grayLight, margin: [44, 0, 0, 0] },
        { text: `Página ${currentPage} de ${pageCount}`, fontSize: 7, color: PA.grayLight, alignment: "right", margin: [0, 0, 44, 0] }
      ]
    }),
    content: [bloqueHeader, paHr([0, 10, 0, 14]), bloqueInfo, paHr(), ...bloquesGrupos, bloqueFirma],
    defaultStyle: { font: "Roboto", fontSize: 9.5, color: PA.black }
  };

  if (typeof pdfMake !== "undefined") {
    const nombreArchivo = `Avance_${nombreProyecto}`.replace(/[^a-zA-Z0-9_-]+/g, "_");
    pdfMake.createPdf(docDefinition).download(`${nombreArchivo}.pdf`);
  } else {
    alert("Error: recarga la página e intenta de nuevo.");
  }
}

if (typeof window !== "undefined") window.generarPDFAvance = generarPDFAvance;
