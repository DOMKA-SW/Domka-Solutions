// js/pdf-cotizacion.js — DOMKA 2025 · Diseño editorial final
// ─────────────────────────────────────────────────────────────
// REGLAS DE DISEÑO (NO ROMPER):
//   • Fondo: #f4efe7 en TODA la página y TODAS las celdas
//   • Acento: #1b7a51 solo en títulos de sección, líneas y valores destacados
//   • Texto: #1A1A1A
//   • CERO fondos oscuros en ningún elemento
//   • Layout: TODO en tablas — nada flota, escala con muchos ítems
// ─────────────────────────────────────────────────────────────

function domkaStaticAssetBase() {
  if (typeof window !== "undefined" && window.DOMKA_PUBLIC_BASE) {
    return String(window.DOMKA_PUBLIC_BASE).replace(/\/$/, "");
  }
  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.origin &&
    window.location.protocol !== "file:"
  ) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
}

async function imageToDataURL(path) {
  try {
    if (path && path.startsWith("data:")) return path;
    let url = path;
    if (!path.startsWith("http")) {
      const base = domkaStaticAssetBase();
      const rel = path.startsWith("/") ? path : "/" + path;
      url = base ? base + rel : rel;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function preloadImages(paths) {
  const imgs = {};
  for (const [k, p] of Object.entries(paths)) imgs[k] = await imageToDataURL(p).catch(() => null);
  return imgs;
}

// ── PALETA DEFINITIVA ─────────────────────────────────────────
const P = {
  bg:        "#f4efe7",   // fondo de toda la página
  bgRow:     "#ede7dc",   // fila alternada (beige un tono más oscuro)
  black:     "#1A1A1A",   // texto principal
  gray:      "#5a5a5a",   // texto secundario
  grayLight: "#9a9a9a",   // etiquetas y pies
  green:     "#1b7a51",   // acento: títulos, líneas, valores destacados
  greenSoft: "#e8f4ee",   // fondo muy suave para celdas de acento (opcional)
  white:     "#FFFFFF",   // solo donde se necesite contraste puntual
  line:      "#c8c0b4"    // líneas divisoras (beige oscuro)
};

// ── CUENTAS BANCARIAS ─────────────────────────────────────────
// ⚠️ Edita aquí tus cuentas reales
const BANCOS = [
  { banco: "Bancolombia",       tipo: "Cuenta de Ahorros",  numero: "912-941792-97",    titular: "Alexander Otalora" }
  //{ banco: "Nequi / Daviplata", tipo: "Billetera Digital",  numero: "+57 305 811 4595", titular: "Alexander Otalora Camayo" }
];

// ── HELPERS ───────────────────────────────────────────────────
function fmtDate(f) {
  if (!f) return "—";
  const d = new Date(f && f.seconds ? f.seconds * 1000 : f);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtM(n) { return `$${Number(n || 0).toLocaleString("es-CO")}`; }

// Etiqueta de sección en verde (todos los títulos de sección)
function sLabel(text) {
  return { text, fontSize: 7.5, bold: true, color: P.green, characterSpacing: 2, font: "Roboto", margin: [0, 0, 0, 7] };
}

// Línea verde
function hr(margin = [0, 14, 0, 12]) {
  return { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: P.green }], margin };
}

// Línea beige suave (sub-divisor)
function hrSoft(margin = [0, 10, 0, 8]) {
  return { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: P.line }], margin };
}

// Celda base (siempre fondo beige, sin borde)
function cell(content, opts = {}) {
  const base = {
    font: "Roboto",
    fontSize: opts.fs || 9.5,
    bold: opts.bold || false,
    color: opts.color || P.black,
    alignment: opts.align || "left",
    fillColor: opts.fill || P.bg,
    border: [false, false, false, false],
    margin: opts.margin || [10, 9, 10, 9]
  };
  if (typeof content === "string" || typeof content === "number") {
    return { ...base, text: content };
  }
  // stack
  return { ...base, stack: content };
}

// ── GENERADOR PRINCIPAL ───────────────────────────────────────
async function generarPDFCotizacion(cotizacion, nombreCliente = "Cliente") {
  const {
    items = [], subtotal = 0, total = 0,
    notas = "", notasArray = null,
    tipo = "mano-obra", formaPago = "contado", planPagos = [],
    fecha = new Date(), mostrarValorLetras = true,
    id = "", firmaAprobacion = null, fechaAprobacion = null,
    tipoCalculo = "por-items", ubicacion = "",
    clienteNit = "", clienteNumeroDocumento = "",
    clienteTipoIdentificacion = "", clienteIdentificacion = "",
    mostrarDocumento = true, adjuntos = []
  } = cotizacion;

  const images = await preloadImages({ logo: "/img/logo.png", firma: "/img/firma.png" });

  const numDoc       = (id || "").substring(0, 8).toUpperCase() || "—";
  const fechaStr     = fmtDate(fecha);
  const fechaAprobStr = fechaAprobacion ? fmtDate(fechaAprobacion) : null;

  const tipoTexto = {
    "mano-obra": "Mano de obra",
    "materiales": "Materiales",
    "ambos": "Mano de obra y materiales"
  }[tipo] || tipo;

  const formaPagoTexto = {
    "contado": "Pago al contado",
    "60-40":   "60% anticipo — 40% al finalizar",
    "50-50":   "50% anticipo — 50% al finalizar",
    "tres-pagos": "Tres cuotas",
    "personalizado": "Plan personalizado"
  }[formaPago] || formaPago;

  // ════════════════════════════════════════════════════════════
  // BLOQUE 1 · ENCABEZADO
  // ════════════════════════════════════════════════════════════
  // Layout: izquierda = nombre empresa + subtítulo
  //         derecha   = "Cotización" + número
  // Fondo: beige. Sin ningún color oscuro.
  const bloqueHeader = {
    table: {
      widths: ["*", "auto"],
      body: [[
        {
          // DOMKA — nombre empresa
          stack: [
            { text: "DOMKA", fontSize: 28, bold: true, color: P.green, font: "Roboto" },
            { text: "Construcción", fontSize: 9, color: P.gray, font: "Roboto", margin: [0, 3, 0, 0] },
            { text: `Fecha: ${fechaStr}` }
          ],
          fillColor: P.bg, border: [false,false,false,false], margin: [0, 0, 20, 0]
        },
        {
          // Tipo de documento + número
          stack: [
            { text: "Cotización", fontSize: 26, bold: true, color: P.black, alignment: "right", font: "Roboto" },
            { text: `N° ${numDoc}`, fontSize: 9, color: P.grayLight, alignment: "right", font: "Roboto", margin: [0, 4, 0, 0] }
          ],
          fillColor: P.bg, border: [false,false,false,false], margin: [0, 0, 0, 0]
        }
      ]]
    },
    layout: "noBorders"
  };

  // Línea verde bajo el header
  const lineaHeader = hr([0, 10, 0, 0]);

  // ════════════════════════════════════════════════════════════
  // BLOQUE 2 · FECHA + LOGO PEQUEÑO (zona gris muy suave)
  // ════════════════════════════════════════════════════════════
  //const bloqueSubHeader = {
    //table: {
      //widths: ["*", "auto"],
      //body: [[
        //images.logo
          //? { image: images.logo, width: 50, fillColor: P.bg, border: [false,false,false,false], margin: [0, 4, 0, 4], alignment: "right" }
          //: { text: "", fillColor: P.bg, border: [false,false,false,false] }
      //]]
    //},
    //layout: "noBorders"
  //};

  // ════════════════════════════════════════════════════════════
  // BLOQUE 3 · CLIENTE + DETALLES DEL PROYECTO
  // ════════════════════════════════════════════════════════════
  const bloqueInfo = {
    table: {
      widths: ["50%", "50%"],
      body: [[
        {
          stack: [
            sLabel("CLIENTE"),
            { text: nombreCliente, fontSize: 14, bold: true, color: P.black, font: "Roboto", margin: [0,0,0,4] },
            ...(ubicacion ? [{ text: ubicacion, fontSize: 9, color: P.gray, font: "Roboto", margin: [0,0,0,2] }] : []),
            ...(() => {
              if (!mostrarDocumento) return [];
              // Preferir campo unificado, caer en legacy
              const tipo = clienteTipoIdentificacion || (clienteNit ? "NIT" : clienteNumeroDocumento ? "Doc" : "");
              const num  = clienteIdentificacion || clienteNit || clienteNumeroDocumento;
              if (!tipo || !num) return [];
              return [{ text: `${tipo}: ${num}`, fontSize: 9, color: P.gray, font: "Roboto" }];
            })()
          ],
          fillColor: P.bg, border: [false,false,false,false], margin: [0, 14, 16, 14]
        },
        {
          stack: [
            sLabel("DETALLES"),
            { text: tipoTexto,     fontSize: 9.5, color: P.black, font: "Roboto", margin: [0,0,0,3] },
            { text: formaPagoTexto, fontSize: 9,  color: P.gray,  font: "Roboto", margin: [0,0,0,3] },
            { text: "Validez: 30 días", fontSize: 9, color: P.gray, font: "Roboto" }
          ],
          fillColor: P.bg, border: [false,false,false,false], margin: [16, 14, 0, 14]
        }
      ]]
    },
    layout: "noBorders"
  };

  // ════════════════════════════════════════════════════════════
  // BLOQUE 4 · TABLA DE ÍTEMS
  // Header: texto verde sobre fondo beige (sin fondo oscuro)
  // Filas: alternas bg / bgRow
  // ════════════════════════════════════════════════════════════

  // Celda de encabezado de tabla — verde, sin fondo oscuro
  const th = (text, align = "left", marginL = 10, marginR = 10) => ({
    text,
    fontSize: 8, bold: true, color: P.green, font: "Roboto",
    alignment: align,
    fillColor: P.bgRow,          // ← fondo beige más oscuro, NO negro
    border: [false, false, false, false],
    margin: [marginL, 9, marginR, 9]
  });

  let tablaItems;

  if (tipoCalculo === "valor-total") {
    tablaItems = {
      table: {
        widths: [28, "*"],
        body: [
          [ th("N°", "center"), th("DESCRIPCIÓN DEL SERVICIO", "left", 12) ],
          ...items.map((it, i) => {
            const bg = i % 2 === 0 ? P.bg : P.bgRow;
            return [
              cell(String(i + 1).padStart(2, "0"), { align: "center", color: P.grayLight, fill: bg, margin: [8,9,8,9] }),
              cell(it.descripcion || "—",          { fill: bg, margin: [12,9,12,9] })
            ];
          })
        ]
      },
      layout: {
        hLineWidth: (i, n) => (i === 0 || i === n.table.body.length) ? 0 : 0.4,
        vLineWidth: () => 0,
        hLineColor: () => P.line
      }
    };
  } else {
    tablaItems = {
      table: {
        widths: [28, "*", 72, 34, 82],
        body: [
          [
            th("N°",         "center",  8,  8),
            th("DESCRIPCIÓN","left",   12,  8),
            th("PRECIO",     "right",   8,  8),
            th("CANT.",      "center",  4,  4),
            th("TOTAL",      "right",   8, 12)
          ],
          ...items.map((it, i) => {
            const bg = i % 2 === 0 ? P.bg : P.bgRow;
            return [
              cell(String(i + 1).padStart(2, "0"), { align: "center", color: P.grayLight, fill: bg, margin: [8,9,8,9]  }),
              cell(it.descripcion || "—",          { fill: bg, margin: [12,9,8,9] }),
              cell(fmtM(it.precio),               { align: "right", color: P.gray, fill: bg, margin: [8,9,8,9] }),
              cell(String(it.cantidad || 1),       { align: "center", color: P.gray, fill: bg, margin: [4,9,4,9] }),
              cell(fmtM(it.subtotal),             { align: "right", bold: true, color: P.green, fill: bg, margin: [8,9,12,9] })
            ];
          })
        ]
      },
      layout: {
        hLineWidth: (i, n) => (i === 0 || i === n.table.body.length) ? 0 : 0.4,
        vLineWidth: () => 0,
        hLineColor: () => P.line
      }
    };
  }

// ════════════════════════════════════════════════════════════
// BLOQUE 5 · TOTAL (único, alineado a la derecha)
// Número grande + valor en letras
// ════════════════════════════════════════════════════════════

const filasTotal = [
  [
    {
      text: "TOTAL",
      fontSize: 10,
      bold: true,
      color: P.green,
      font: "Roboto",
      border: [false, false, false, false],
      margin: [0, 6, 16, 4],
      fillColor: P.bg
    },
    {
      text: fmtM(total),
      fontSize: 16,
      bold: true,
      color: P.green,
      alignment: "right",
      font: "Roboto",
      border: [false, false, false, false],
      margin: [0, 6, 0, 4],
      fillColor: P.bg
    }
  ]
];

// Total en letras (opcional)
if (mostrarValorLetras && typeof numeroAPalabras === "function") {
  filasTotal.push([
    {
      text: "SON:",
      fontSize: 8,
      color: P.grayLight,
      font: "Roboto",
      border: [false, false, false, false],
      margin: [0, 0, 16, 0],
      fillColor: P.bg
    },
    {
      text: numeroAPalabras(total),
      fontSize: 8,
      italic: true,
      color: P.grayLight,
      alignment: "right",
      font: "Roboto",
      border: [false, false, false, false],
      margin: [0, 0, 0, 0],
      fillColor: P.bg
    }
  ]);
}

const bloqueTotales = {
  table: {
    widths: ["*", 200],
    body: [
      [
        {}, // columna izquierda vacía
        {
          table: {
            widths: ["*", "auto"],
            body: filasTotal
          },
          layout: "noBorders",
          fillColor: P.bg,
          border: [false, false, false, false],
          margin: [0, 14, 0, 14]
        }
      ]
    ]
  },
  layout: "noBorders"
};

  // ════════════════════════════════════════════════════════════
  // BLOQUE 6 · PLAN DE PAGOS
  // ════════════════════════════════════════════════════════════
  const bloquePagos = planPagos.length > 0 ? [
    hr(),
    sLabel("PLAN DE PAGOS"),
    {
      table: {
        widths: ["*", 55, 90],
        body: [
          [ th("Descripción","left",12), th("Porcentaje","center",6,6), th("Valor","right",6,12) ],
          ...planPagos.map((p, i) => {
            const bg = i % 2 === 0 ? P.bg : P.bgRow;
            return [
              cell(p.descripcion || "—",   { fill: bg, margin: [12,9,8,9] }),
              cell(`${p.porcentaje}%`,     { align: "center", color: P.gray, fill: bg, margin: [6,9,6,9] }),
              cell(fmtM(p.monto),         { align: "right", bold: true, color: P.green, fill: bg, margin: [6,9,12,9] })
            ];
          })
        ]
      },
      layout: { hLineWidth: (i,n) => (i===0||i===n.table.body.length)?0:0.4, vLineWidth:()=>0, hLineColor:()=>P.line }
    }
  ] : [];

// ════════════════════════════════════════════════════════════
// BLOQUE 7 · MÉTODOS DE PAGO (versión compacta)
// ════════════════════════════════════════════════════════════
const bancoCeldas = BANCOS.map(b => ({
  stack: [
    { text: b.banco,                fontSize: 10, bold: true, color: P.black, font: "Roboto", margin: [0,0,0,1] },
    { text: b.tipo,                  fontSize: 7,  color: P.grayLight,       font: "Roboto", margin: [0,0,0,4] },
    { text: b.numero,                fontSize: 10, bold: true, color: P.green, font: "Roboto", margin: [0,0,0,2] },
    { text: `Titular: ${b.titular}`, fontSize: 7, color: P.gray,              font: "Roboto" }
  ],
  fillColor: P.bgRow,
  border: [false,false,false,false],
  margin: [8, 8, 8, 8]  // márgenes reducidos
}));

const bloquePago = [
  hr(),
  sLabel("MÉTODO DE PAGO", { fontSize: 10 }),  // si tu sLabel permite pasar fontSize
  {
    table: {
      widths: BANCOS.map(() => "*"),
      body: [bancoCeldas]
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i) => (i > 0 && i < BANCOS.length) ? 0.4 : 0,
      vLineColor: () => P.line
    }
  }
];

  // ════════════════════════════════════════════════════════════
  // BLOQUE 8 · NOTAS
  // ════════════════════════════════════════════════════════════
  const notasLineas = (() => {
    if (notasArray && notasArray.length > 0) return notasArray.map(n => n.trim()).filter(Boolean);
    if (notas) return notas.split("\n").map(l => l.trim()).filter(Boolean);
    return [];
  })();

  const bloqueNotas = notasLineas.length > 0 ? [
    hr(),
    sLabel("NOTAS"),
    { ul: notasLineas, fontSize: 9.5, color: P.gray, font: "Roboto", lineHeight: 1.5, markerColor: P.green }
  ] : [];

  // ════════════════════════════════════════════════════════════
  // BLOQUE 9 · TÉRMINOS Y CONDICIONES
  // ════════════════════════════════════════════════════════════
  const bloqueTerminos = [
    hr(),
    sLabel("TÉRMINOS Y CONDICIONES"),
    {
      table: {
        widths: ["*", "*"],
        body: [[
          {
            ul: [
              "Esta cotización tiene validez de 30 días a partir de la fecha de emisión.",
              "El tiempo de entrega se confirmará al momento de la aprobación."
            ],
            fontSize: 8.5, color: P.gray, font: "Roboto", lineHeight: 1.4, markerColor: P.green,
            fillColor: P.bg, border: [false,false,false,false], margin: [0, 0, 12, 0]
          },
          {
            ul: [
              formaPago !== "contado"
                ? "Se requiere anticipo para iniciar según el plan de pagos acordado."
                : "Pago al contado al finalizar el servicio.",
              "Cualquier trabajo adicional no contemplado generará un cobro extra."
            ],
            fontSize: 8.5, color: P.gray, font: "Roboto", lineHeight: 1.4, markerColor: P.green,
            fillColor: P.bg, border: [false,false,false,false], margin: [12, 0, 0, 0]
          }
        ]]
      },
      layout: "noBorders"
    }
  ];

  // ════════════════════════════════════════════════════════════
  // BLOQUE 10 · APROBACIÓN (firma cliente, si existe)
  // ════════════════════════════════════════════════════════════
  //const bloqueAprobacion = firmaAprobacion ? [
    //hr(),
    //{
      //table: {
        //widths: ["*", 200],
        //body: [[
          //{ text: "", fillColor: P.bg, border: [false,false,false,false] },
          //{
            //stack: [
              // Línea verde decorativa arriba
              //{ canvas: [{ type: "line", x1: 0, y1: 0, x2: 185, y2: 0, lineWidth: 2, lineColor: P.green }], margin: [0,0,0,10] },
              //sLabel("APROBADO POR"),
              //...(fechaAprobStr ? [{ text: `Fecha: ${fechaAprobStr}`, fontSize: 8.5, color: P.gray, font: "Roboto", margin: [0,0,0,8] }] : []),
              //{ image: firmaAprobacion, width: 115, margin: [0,0,0,5] },
              //{ text: nombreCliente,       fontSize: 9, bold: true, color: P.black,   font: "Roboto" },
              //{ text: "Firma del cliente", fontSize: 8,             color: P.grayLight, font: "Roboto" }
            //],
            //fillColor: P.bg, border: [false,false,false,false], margin: [0,0,0,0]
          //}
        //]]
      //},
      //layout: "noBorders"
    //}
  //] : [];

  // ════════════════════════════════════════════════════════════
  // BLOQUE 11 · FIRMA EMPRESA + CONTACTO
  // ════════════════════════════════════════════════════════════
  const bloqueEmpresa = [
    hr([0, 22, 0, 18]),
    {
      table: {
        widths: ["45%", "*", "35%"],
        body: [[
          {
            stack: [
              sLabel("CONTÁCTANOS"),
              { text: "piter030509@gmail.com",            fontSize: 9, color: P.gray, font: "Roboto", margin: [0,0,0,2] },
              { text: "Cel: +57 305 811 4595",            fontSize: 9, color: P.gray, font: "Roboto", margin: [0,0,0,2] },
              { text: "RUT: 79.597.683-1",                fontSize: 9, color: P.gray, font: "Roboto" }
            ],
            fillColor: P.bg, border: [false,false,false,false], margin: [0,0,0,0]
          },
          { text: "", fillColor: P.bg, border: [false,false,false,false] },
          {
            stack: [
              sLabel("ELABORADO POR"),
              images.firma
                ? { image: images.firma, width: 100, margin: [0, 6, 0, 8] }
                : { text: "— firma —", fontSize: 9, italic: true, color: P.grayLight, font: "Roboto", margin: [0,16,0,8] },
              { text: "Alexander Otalora Camayo",  fontSize: 10, bold: true, color: P.black,     font: "Roboto" },
              { text: "DOMKA",                    fontSize: 8.5,             color: P.grayLight, font: "Roboto" }
            ],
            fillColor: P.bg, border: [false,false,false,false], margin: [0,0,0,0]
          }
        ]]
      },
      layout: "noBorders"
    }
  ];

  // ════════════════════════════════════════════════════════════
  // ADJUNTOS (páginas adicionales)
  // ════════════════════════════════════════════════════════════
  const paginasAdjuntos = [];
  for (const adj of (adjuntos || [])) {
    if (adj.tipo && adj.tipo.startsWith("image/") && adj.datos) {
      paginasAdjuntos.push({ text: "", pageBreak: "before" });
      paginasAdjuntos.push(sLabel(`ADJUNTO: ${(adj.nombre || "IMAGEN").toUpperCase()}`));
      paginasAdjuntos.push({ image: adj.datos, width: 490 });
    } else if (adj.tipo === "application/pdf") {
      paginasAdjuntos.push({ text: "", pageBreak: "before" });
      paginasAdjuntos.push({
        text: `Adjunto PDF: "${adj.nombre}" — disponible en el link público de la cotización.`,
        fontSize: 9, color: P.grayLight, font: "Roboto", italic: true, margin: [0,20,0,0]
      });
    }
  }

  // ════════════════════════════════════════════════════════════
  // FOOTER
  // ════════════════════════════════════════════════════════════
  const footerFn = (pg, total) => ({
    table: {
      widths: ["*", "auto"],
      body: [[
        { text: `DOMKA Construcción  ·  +57 305 811 4595  ·  piter030509@gmail.com`, fontSize: 7, color: P.grayLight, font: "Roboto", border: [false,false,false,false], margin: [45,0,0,0] },
        { text: `Página ${pg} de ${total}`, fontSize: 7, color: P.grayLight, font: "Roboto", alignment: "right", border: [false,false,false,false], margin: [0,0,45,0] }
      ]]
    },
    layout: "noBorders",
    margin: [0,6,0,0]
  });

  // ════════════════════════════════════════════════════════════
  // BACKGROUND: fondo beige uniforme + logo marca de agua
  // ════════════════════════════════════════════════════════════
  const bgFn = (currentPage, pageSize) => {
    const elems = [
      { canvas: [{ type: "rect", x: 0, y: 0, w: pageSize.width, h: pageSize.height, color: P.bg }] }
    ];
    if (images.logo) {
      elems.push({
        image: images.logo, width: 260, opacity: 0.035,
        absolutePosition: { x: (pageSize.width - 260) / 2, y: (pageSize.height - 260) / 2 }
      });
    }
    return elems;
  };

  // ════════════════════════════════════════════════════════════
  // DOCUMENTO FINAL
  // ════════════════════════════════════════════════════════════
  const docDefinition = {
    pageSize:    "A4",
    pageMargins: [48, 44, 44, 52],
    footer:      footerFn,
    background:  bgFn,

    content: [
      bloqueHeader,
      lineaHeader,
      //bloqueSubHeader,
      hr(),
      bloqueInfo,
      hr(),
      sLabel("DETALLE DE LA COTIZACIÓN"),
      tablaItems,
      hr([0, 10, 0, 0]),
      bloqueTotales,
      ...bloquePagos,
      ...bloquePago,
      ...bloqueNotas,
      ...bloqueTerminos,
      //...bloqueAprobacion,
      ...bloqueEmpresa,
      ...paginasAdjuntos
    ],

    defaultStyle: { font: "Roboto", fontSize: 10, color: P.black }
  };

  if (typeof pdfMake !== "undefined") {
    pdfMake.createPdf(docDefinition).download(`Cotizacion_DOMKA_${numDoc}.pdf`);
  } else {
    alert("Error: recarga la página e intenta de nuevo.");
  }
}

if (typeof window !== "undefined") window.generarPDFCotizacion = generarPDFCotizacion;
