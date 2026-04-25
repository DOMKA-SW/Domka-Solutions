// js/pdf-cuenta.js — DOMKA 2025 · Diseño editorial final
// Mismo lenguaje visual que pdf-cotizacion.js
// REGLAS: fondo #f4efe7 · acento #1b7a51 · texto #1A1A1A · CERO fondos oscuros

async function imageToDataURL(path) {
  try {
    if (path && path.startsWith("data:")) return path;
    let url = path;
    if (!path.startsWith("http")) {
      url = `https://domka-sw.github.io/domka-cotizador${path.startsWith("/") ? path : "/" + path}`;
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

async function preloadImagesCuenta(paths) {
  const imgs = {};
  for (const [k, p] of Object.entries(paths)) imgs[k] = await imageToDataURL(p).catch(() => null);
  return imgs;
}

const PC = {
  bg:        "#f4efe7",
  bgRow:     "#ede7dc",
  black:     "#1A1A1A",
  gray:      "#5a5a5a",
  grayLight: "#9a9a9a",
  green:     "#1b7a51",
  line:      "#c8c0b4"
};

// ⚠️ Edita aquí tus cuentas reales
const BANCOS_CC = [
  { banco: "Bancolombia",       tipo: "Cuenta de Ahorros",  numero: "912-941792-97",    titular: "Alexander Otalora" }
  //{ banco: "Nequi / Daviplata", tipo: "Billetera Digital",  numero: "+57 305 811 4595", titular: "Alexander Otalora Camayo" }
];

function fmtDateCC(f) {
  if (!f) return "—";
  const d = new Date(f && f.seconds ? f.seconds * 1000 : f);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtMCC(n) { return `$${Number(n || 0).toLocaleString("es-CO")}`; }

function sLabelCC(text) {
  return { text, fontSize: 7.5, bold: true, color: PC.green, characterSpacing: 2, font: "Roboto", margin: [0,0,0,7] };
}
function hrCC(margin = [0,14,0,12]) {
  return { canvas: [{ type: "line", x1:0, y1:0, x2:515, y2:0, lineWidth:1, lineColor:PC.green }], margin };
}
function cellCC(content, opts = {}) {
  return {
    text: content, font: "Roboto",
    fontSize: opts.fs || 9.5, bold: opts.bold || false,
    color: opts.color || PC.black, alignment: opts.align || "left",
    fillColor: opts.fill || PC.bg,
    border: [false,false,false,false],
    margin: opts.margin || [10,9,10,9]
  };
}

async function generarPDFCuenta(cuenta, nombreCliente = "Cliente") {
  const {
    items = [], total = 0,
    notas = "", notasArray = null,
    fecha = new Date(), mostrarValorLetras = true,
    id = "", firmaConfirmacion = null, fechaConfirmacion = null,
    concepto = "",
    clienteNit = "", clienteNumeroDocumento = "",
    clienteTipoIdentificacion = "", clienteIdentificacion = "",
    mostrarDocumento = true, adjuntos = []
  } = cuenta;

  const images = await preloadImagesCuenta({ logo: "/img/logo.png", firma: "/img/firma.png" });

  const numDoc      = (id || "").substring(0, 8).toUpperCase() || "—";
  const fechaStr    = fmtDateCC(fecha);
  const fechaConfStr = fechaConfirmacion ? fmtDateCC(fechaConfirmacion) : null;

  // ── HEADER ────────────────────────────────────────────────
  const bloqueHeader = {
    table: {
      widths: ["*", "auto"],
      body: [[
        {
          stack: [
            { text: "DOMKA", fontSize: 28, bold: true, color: PC.green, font: "Roboto" },
            { text: "Construcción", fontSize: 9, color: PC.gray, font: "Roboto", margin: [0,3,0,0] },
            { text: `Fecha: ${fechaStr}`, fontSize: 9, color: PC.gray, font: "Roboto", fillColor: PC.bg, border: [false,false,false,false], margin: [0,8,0,8] }
          ],
          fillColor: PC.bg, border: [false,false,false,false], margin: [0,0,20,0]
        },
        {
          stack: [
            { text: "Cuenta de Cobro", fontSize: 24, bold: true, color: PC.black, alignment: "right", font: "Roboto" },
            { text: `N° ${numDoc}`, fontSize: 9, color: PC.grayLight, alignment: "right", font: "Roboto", margin: [0,4,0,0] }
          ],
          fillColor: PC.bg, border: [false,false,false,false], margin: [0,0,0,0]
        }
      ]]
    },
    layout: "noBorders"
  };

  const lineaHeader = hrCC([0,10,0,0]);

  // Sub-header: fecha + logo
  //const bloqueSubHeader = {
    //table: {
      //widths: ["*","auto"],
      //body: [[
        //{ text: `Fecha: ${fechaStr}`, fontSize: 9, color: PC.gray, font: "Roboto", fillColor: PC.bg, border: [false,false,false,false], margin: [0,8,0,8] },
        //images.logo
          //? { image: images.logo, width: 50, fillColor: PC.bg, border: [false,false,false,false], margin: [0,4,0,4] }
          //: { text: "", fillColor: PC.bg, border: [false,false,false,false] }
      //]]
    //},
    //layout: "noBorders"
  //};

  // ── "DEBE A" ─────────────────────────────────────────────
  // Tabla 3 cols: línea | DEBE A | línea
  const bloqueDebeA = {
    table: {
      widths: ["*","auto","*"],
      body: [[
        { canvas: [{ type:"line", x1:0, y1:5, x2:200, y2:5, lineWidth:0.5, lineColor:PC.line }], fillColor:PC.bg, border:[false,false,false,false] },
        { text:"DEBE A", fontSize:7.5, bold:true, color:PC.grayLight, characterSpacing:3, font:"Roboto", alignment:"center", fillColor:PC.bg, border:[false,false,false,false], margin:[14,0,14,0] },
        { canvas: [{ type:"line", x1:0, y1:5, x2:200, y2:5, lineWidth:0.5, lineColor:PC.line }], fillColor:PC.bg, border:[false,false,false,false] }
      ]]
    },
    layout: "noBorders",
    margin: [0,16,0,10]
  };

  const bloqueNombreEmpresa = {
    table: {
      widths:["*"],
      body:[[{
        stack:[
          { text:"Alexander Otalora Camayo", fontSize:16, bold:true, color:PC.black, alignment:"center", font:"Roboto", margin:[0,0,0,3] },
          { text:"DOMKA Construcción", fontSize:9, color:PC.grayLight, alignment:"center", font:"Roboto" }
        ],
        fillColor:PC.bg, border:[false,false,false,false], margin:[0,0,0,0]
      }]]
    },
    layout:"noBorders"
  };

  // ── INFO CLIENTE ─────────────────────────────────────────
  const bloqueInfo = {
    table: {
      widths: ["50%","50%"],
      body: [[
        {
          stack: [
            sLabelCC("CLIENTE"),
            { text: nombreCliente, fontSize:13, bold:true, color:PC.black, font:"Roboto", margin:[0,0,0,4] },
            ...(() => {
              if (!mostrarDocumento) return [];
              const tipo = clienteTipoIdentificacion || (clienteNit ? "NIT" : clienteNumeroDocumento ? "Doc" : "");
              const num  = clienteIdentificacion || clienteNit || clienteNumeroDocumento;
              if (!tipo || !num) return [];
              return [{ text: `${tipo}: ${num}`, fontSize: 9, color: PC.gray, font: "Roboto" }];
            })()
          ],
          fillColor:PC.bg, border:[false,false,false,false], margin:[0,14,16,14]
        },
        {
          stack: [
            sLabelCC("DETALLES"),
            { text: fechaStr,         fontSize:9, color:PC.gray,  font:"Roboto", margin:[0,0,0,2] },
            { text: `N°: ${numDoc}`,  fontSize:9, color:PC.black, font:"Roboto", bold:true }
          ],
          fillColor:PC.bg, border:[false,false,false,false], margin:[16,14,0,14]
        }
      ]]
    },
    layout: "noBorders"
  };

  // ── CONCEPTO ─────────────────────────────────────────────
  const bloqueConcepto = concepto ? [
    hrCC(),
    sLabelCC("POR CONCEPTO DE"),
    { text: concepto, fontSize:11, bold:true, color:PC.black, font:"Roboto" }
  ] : [];

  // ── TABLA SERVICIOS ───────────────────────────────────────
  const thCC = (text, align = "left", mL = 10, mR = 10) => ({
    text, fontSize:8, bold:true, color:PC.green, font:"Roboto",
    alignment: align, fillColor: PC.bgRow,
    border:[false,false,false,false], margin:[mL,9,mR,9]
  });

  const tablaItems = {
    table: {
      widths: [28,"*"],
      body: [
        [ thCC("N°","center",8,8), thCC("DESCRIPCIÓN DEL SERVICIO","left",12,12) ],
        ...items.map((it,i) => {
          const bg = i%2===0 ? PC.bg : PC.bgRow;
          return [
            cellCC(String(i+1).padStart(2,"0"), { align:"center", color:PC.grayLight, fill:bg, margin:[8,9,8,9] }),
            cellCC(it.descripcion||"—",          { fill:bg, margin:[12,9,12,9] })
          ];
        })
      ]
    },
    layout: {
      hLineWidth:(i,n)=>(i===0||i===n.table.body.length)?0:0.4,
      vLineWidth:()=>0, hLineColor:()=>PC.line
    }
  };

// ── TOTAL ─────────────────────────────────────────────────
const bloqueTotales = {
  table: {
    widths: ["*", 200], // primera columna vacía empuja a la derecha
    body: [[
      {}, // columna izquierda vacía
      {
        stack: [
          { text:"TOTAL", fontSize:8.5, bold:true,  color:PC.grayLight, font:"Roboto", margin:[0,0,0,4] },
          { text:fmtMCC(total), fontSize:13, bold:true,  color:PC.green, font:"Roboto" },
          { text:`Son: ${numeroAPalabras(total)}`, fontSize:8, italic:true, color:PC.grayLight, font:"Roboto" }
        ],
        fillColor:PC.bg,
        border:[false,false,false,false],
        margin:[0,14,0,14]
      }
    ]]
  },
  layout:"noBorders"
};
  // ── MÉTODOS DE PAGO ───────────────────────────────────────
  const bancoCeldasCC = BANCOS_CC.map(b => ({
    stack:[
      { text:b.banco,               fontSize:11, bold:true, color:PC.black,     font:"Roboto", margin:[0,0,0,2] },
      { text:b.tipo,                fontSize:8,             color:PC.grayLight, font:"Roboto", margin:[0,0,0,8] },
      { text:b.numero,              fontSize:12, bold:true, color:PC.green,     font:"Roboto", margin:[0,0,0,3] },
      { text:`Titular: ${b.titular}`, fontSize:8,           color:PC.gray,      font:"Roboto" }
    ],
    fillColor:PC.bgRow, border:[false,false,false,false], margin:[16,14,16,14]
  }));

  const bloquePago = [
    hrCC(),
    sLabelCC("MÉTODO DE PAGO"),
    {
      table: { widths: BANCOS_CC.map(()=>"*"), body:[bancoCeldasCC] },
      layout: {
        hLineWidth:()=>0,
        vLineWidth:(i)=>(i>0&&i<BANCOS_CC.length)?0.6:0,
        vLineColor:()=>PC.line
      }
    }
  ];

  // ── NOTAS ─────────────────────────────────────────────────
  const notasLineas = (() => {
    if (notasArray && notasArray.length>0) return notasArray.map(n=>n.trim()).filter(Boolean);
    if (notas) return notas.split("\n").map(l=>l.trim()).filter(Boolean);
    return [];
  })();

  const bloqueNotas = notasLineas.length>0 ? [
    hrCC(),
    sLabelCC("NOTAS"),
    { ul:notasLineas, fontSize:9.5, color:PC.gray, font:"Roboto", lineHeight:1.5, markerColor:PC.green }
  ] : [];

  // ── CONFIRMACIÓN ──────────────────────────────────────────
  //const bloqueConfirmacion = firmaConfirmacion ? [
    //hrCC(),
    //{
      //table: {
        //widths:["*",200],
        //body:[[
          //{ text:"", fillColor:PC.bg, border:[false,false,false,false] },
          //{
            //stack:[
              //{ canvas:[{type:"line",x1:0,y1:0,x2:185,y2:0,lineWidth:2,lineColor:PC.green}], margin:[0,0,0,10] },
              //sLabelCC("CONFORMIDAD DEL CLIENTE"),
              //...(fechaConfStr?[{text:`Fecha: ${fechaConfStr}`,fontSize:8.5,color:PC.gray,font:"Roboto",margin:[0,0,0,8]}]:[]),
              //{ image:firmaConfirmacion, width:115, margin:[0,0,0,5] },
              //{ text:nombreCliente,       fontSize:9, bold:true, color:PC.black,     font:"Roboto" },
              //{ text:"Firma del cliente", fontSize:8,             color:PC.grayLight, font:"Roboto" }
            //],
            //fillColor:PC.bg, border:[false,false,false,false]
          //}
        //]]
      //},
      //layout:"noBorders"
    //}
  //] : [];

  // ── FIRMA EMPRESA ─────────────────────────────────────────
  const bloqueEmpresa = [
    hrCC([0,22,0,18]),
    {
      table: {
        widths:["45%","*","35%"],
        body:[[
          {
            stack:[
              sLabelCC("CONTÁCTANOS"),
              { text:"piter030509@gmail.com",         fontSize:9, color:PC.gray, font:"Roboto", margin:[0,0,0,2] },
              { text:"Cel: +57 305 811 4595",          fontSize:9, color:PC.gray, font:"Roboto", margin:[0,0,0,2] },
              { text:"RUT: 79.597.683-1",              fontSize:9, color:PC.gray, font:"Roboto" }
            ],
            fillColor:PC.bg, border:[false,false,false,false], margin:[0,0,0,0]
          },
          { text:"", fillColor:PC.bg, border:[false,false,false,false] },
          {
            stack:[
              sLabelCC("ELABORADO POR"),
              images.firma
                ? { image:images.firma, width:100, margin:[0,6,0,8] }
                : { text:"— firma —", fontSize:9, italic:true, color:PC.grayLight, font:"Roboto", margin:[0,16,0,8] },
              { text:"Alexander Otalora Camayo", fontSize:10, bold:true, color:PC.black,     font:"Roboto" },
              { text:"DOMKA",                   fontSize:8.5,             color:PC.grayLight, font:"Roboto" }
            ],
            fillColor:PC.bg, border:[false,false,false,false], margin:[0,0,0,0]
          }
        ]]
      },
      layout:"noBorders"
    }
  ];

  // ── ADJUNTOS ──────────────────────────────────────────────
  const paginasAdjuntos = [];
  for (const adj of (adjuntos||[])) {
    if (adj.tipo && adj.tipo.startsWith("image/") && adj.datos) {
      paginasAdjuntos.push({ text:"", pageBreak:"before" });
      paginasAdjuntos.push(sLabelCC(`ADJUNTO: ${(adj.nombre||"IMAGEN").toUpperCase()}`));
      paginasAdjuntos.push({ image:adj.datos, width:490 });
    } else if (adj.tipo==="application/pdf") {
      paginasAdjuntos.push({ text:"", pageBreak:"before" });
      paginasAdjuntos.push({ text:`Adjunto PDF: "${adj.nombre}" — disponible en el link público.`, fontSize:9, color:PC.grayLight, font:"Roboto", italic:true, margin:[0,20,0,0] });
    }
  }

  // ── FOOTER + BACKGROUND ───────────────────────────────────
  const footerFn = (pg,tot) => ({
    table: {
      widths:["*","auto"],
      body:[[
        { text:`DOMKA Construcción  ·  +57 305 811 4595  ·  piter030509@gmail.com`, fontSize:7, color:PC.grayLight, font:"Roboto", border:[false,false,false,false], margin:[45,0,0,0] },
        { text:`Página ${pg} de ${tot}`, fontSize:7, color:PC.grayLight, font:"Roboto", alignment:"right", border:[false,false,false,false], margin:[0,0,45,0] }
      ]]
    },
    layout:"noBorders", margin:[0,6,0,0]
  });

  const bgFn = (pg,pageSize) => {
    const elems = [{ canvas:[{type:"rect",x:0,y:0,w:pageSize.width,h:pageSize.height,color:PC.bg}] }];
    if (images.logo) elems.push({ image:images.logo, width:260, opacity:0.035, absolutePosition:{x:(pageSize.width-260)/2,y:(pageSize.height-260)/2} });
    return elems;
  };

  const docDefinition = {
    pageSize:"A4", pageMargins:[48,44,44,52],
    footer:footerFn, background:bgFn,
    content:[
      bloqueHeader, lineaHeader, //bloqueSubHeader,
      hrCC(),
      bloqueDebeA,
      bloqueNombreEmpresa,
      hrCC([0,14,0,14]),
      bloqueInfo,
      ...bloqueConcepto,
      hrCC(),
      sLabelCC("DESCRIPCIÓN DEL SERVICIO"),
      tablaItems,
      hrCC([0,10,0,0]),
      bloqueTotales,
      ...bloquePago,
      ...bloqueNotas,
      //...bloqueConfirmacion,
      ...bloqueEmpresa,
      ...paginasAdjuntos
    ],
    defaultStyle:{ font:"Roboto", fontSize:10, color:PC.black }
  };

  try {
    pdfMake.createPdf(docDefinition).download(`CuentaCobro_DOMKA_${numDoc}.pdf`);
  } catch(err) {
    console.error("Error PDF:", err);
    pdfMake.createPdf({
      pageSize:"A4",
      content:[
        { text:"DOMKA — CUENTA DE COBRO", fontSize:18, bold:true, color:PC.green },
        { text:`Cliente: ${nombreCliente}`, margin:[0,10,0,5] },
        { text:`Total: $${Number(total).toLocaleString("es-CO")}`, fontSize:14, bold:true, color:PC.green }
      ],
      defaultStyle:{ font:"Roboto" }
    }).download(`CuentaCobro_DOMKA_${numDoc}.pdf`);
  }
}

if (typeof window !== "undefined") window.generarPDFCuenta = generarPDFCuenta;
