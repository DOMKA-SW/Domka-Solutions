// ═══════════════════════════════════════════════════════════
//  DOMKA — Corrector de Ortografía (tiempo real)
//  Técnica: borde rojo + chips de errores debajo del campo
//  Rojo = ortografía · Naranja = gramática
//  LanguageTool API — gratis, sin API key
// ═══════════════════════════════════════════════════════════

const LT_URL  = "https://api.languagetool.org/v2/check";
const _ltData = new WeakMap(); // el → { errBox, timer }

// ── Estilos ───────────────────────────────────────────────
(function() {
  if (document.getElementById("lt-styles")) return;
  const s = document.createElement("style");
  s.id = "lt-styles";
  s.textContent = `
    .lt-err-box {
      margin-top: 5px;
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      min-height: 0;
    }
    .lt-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px 3px 8px;
      border-radius: 20px;
      font-size: 11.5px;
      font-family: 'DM Sans', sans-serif;
      font-weight: 500;
      line-height: 1.4;
    }
    .lt-chip-spell {
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fca5a5;
    }
    .lt-chip-grammar {
      background: #fff7ed;
      color: #9a3412;
      border: 1px solid #fdba74;
    }
    .lt-chip-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .lt-chip-spell   .lt-chip-dot { background: #ef4444; }
    .lt-chip-grammar .lt-chip-dot { background: #f97316; }
    .lt-chip-sug {
      font-weight: 700;
      margin-left: 2px;
      cursor: pointer;
      text-decoration: underline;
      text-decoration-style: dotted;
    }
    .lt-ok {
      font-size: 11px;
      color: #1b7a51;
      font-family: 'DM Sans', sans-serif;
      font-weight: 600;
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .lt-field-error {
      border-color: #ef4444 !important;
      box-shadow: 0 0 0 3px rgba(239,68,68,.1) !important;
    }
    .lt-field-ok {
      border-color: #1b7a51 !important;
      box-shadow: 0 0 0 3px rgba(27,122,81,.1) !important;
    }
  `;
  document.head.appendChild(s);
})();

// ── Revisar con API ───────────────────────────────────────
async function ltCheck(el) {
  const data = _ltData.get(el);
  if (!data) return;

  const text = el.value.trim();

  if (!text) {
    el.classList.remove("lt-field-error", "lt-field-ok");
    data.errBox.innerHTML = "";
    return;
  }

  try {
    const res = await fetch(LT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text, language: "es" })
    });
    if (!res.ok) return;
    const json = await res.json();

    const matches = (json.matches || []).filter(m =>
      m.length > 0 &&
      m.rule?.id !== "UPPERCASE_SENTENCE_START" &&
      m.rule?.category?.id !== "PUNCTUATION" &&
      m.rule?.category?.id !== "TYPOGRAPHY"
    );

    renderErrors(el, data.errBox, text, matches);
  } catch {
    // Silencioso si la API falla (sin conexión, etc.)
  }
}

function renderErrors(el, box, text, matches) {
  if (matches.length === 0) {
    el.classList.remove("lt-field-error");
    el.classList.add("lt-field-ok");
    box.innerHTML = `<span class="lt-ok">✓ Sin errores</span>`;
    setTimeout(() => {
      el.classList.remove("lt-field-ok");
      box.innerHTML = "";
    }, 2500);
    return;
  }

  el.classList.remove("lt-field-ok");
  el.classList.add("lt-field-error");

  box.innerHTML = matches.map(m => {
    const palabra  = text.substring(m.offset, m.offset + m.length);
    const tipo     = (m.rule?.issueType === "grammar" || m.rule?.category?.id === "GRAMMAR")
                     ? "grammar" : "spell";
    const cls      = `lt-chip lt-chip-${tipo}`;
    const sugs     = (m.replacements || []).slice(0, 2).map(s => s.value);
    const sugHTML  = sugs.length
      ? ` → <span class="lt-chip-sug"
              data-original="${encodeURIComponent(palabra)}"
              data-sug="${encodeURIComponent(sugs[0])}"
              title="Clic para corregir">${sugs[0]}</span>`
      : "";

    return `<span class="${cls}">
      <span class="lt-chip-dot"></span>
      <strong>${palabra}</strong>${sugHTML}
    </span>`;
  }).join("");

  // Clic en sugerencia → aplicar corrección directamente en el campo
  box.querySelectorAll(".lt-chip-sug").forEach(btn => {
    btn.addEventListener("click", () => {
      const original = decodeURIComponent(btn.dataset.original);
      const sug      = decodeURIComponent(btn.dataset.sug);
      // Reemplazar solo la primera ocurrencia que coincida
      const regex    = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "");
      el.value       = el.value.replace(regex, sug);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
}

// ── Registrar un campo ────────────────────────────────────
function ltRegister(el) {
  if (!el || _ltData.has(el)) return;

  // Caja de errores debajo del campo
  const errBox = document.createElement("div");
  errBox.className = "lt-err-box";
  el.parentElement.insertBefore(errBox, el.nextSibling);

  _ltData.set(el, { errBox, timer: null });

  el.addEventListener("input", () => {
    el.classList.remove("lt-field-error", "lt-field-ok");
    errBox.innerHTML = "";
    const d = _ltData.get(el);
    clearTimeout(d.timer);
    d.timer = setTimeout(() => ltCheck(el), 900);
  });

  // Revisar al salir del campo (blur) si tiene texto
  el.addEventListener("blur", () => {
    if (el.value.trim()) ltCheck(el);
  });

  // Si ya tiene texto al cargar
  if (el.value.trim()) setTimeout(() => ltCheck(el), 800);
}

// ── API pública ───────────────────────────────────────────

// Activar campos estáticos — llamar en DOMContentLoaded
window.ltActivar = function() {
  ["notas", "ubicacion", "concepto"].forEach(id => {
    const el = document.getElementById(id);
    if (el) ltRegister(el);
  });
};

// Activar un campo individual (para ítems creados dinámicamente)
window.ltReg = function(el) { ltRegister(el); };

// Observer automático para ítems y viñetas dinámicas
const _ltObs = new MutationObserver(muts => {
  muts.forEach(m => m.addedNodes.forEach(node => {
    if (node.nodeType !== 1) return;
    node.querySelectorAll?.("input.desc, input.item-desc, input.nota-vineta-input")
        .forEach(ltRegister);
    if (node.matches?.("input.desc, input.item-desc, input.nota-vineta-input"))
      ltRegister(node);
  }));
});

window.ltObservar = function(contenedor) {
  if (contenedor) _ltObs.observe(contenedor, { childList: true, subtree: true });
};
