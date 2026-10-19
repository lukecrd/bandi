import type { Anagrafica } from "@/lib/types";

// shortcut: label-matching heuristics, may miss fields on unusual portals; add per-portal mappings if a portal is used often
export const SYNONYMS: Record<keyof Anagrafica, string[]> = {
  partita_iva: ["partita iva", "p iva", "piva", "vat", "numero partita iva"],
  codice_fiscale: ["codice fiscale", "cf", "codice fiscale impresa", "codice fiscale ente", "cf impresa", "codice fiscale azienda"],
  denominazione: ["denominazione", "ragione sociale", "nome impresa", "nome azienda", "denominazione impresa"],
  forma_giuridica: ["forma giuridica", "natura giuridica"],
  pec: ["pec", "posta elettronica certificata", "indirizzo pec", "email pec"],
  rea: ["rea", "numero rea", "n rea", "iscrizione rea"],
  data_costituzione: ["data costituzione", "data di costituzione"],
  sede_indirizzo: ["indirizzo", "via", "indirizzo sede", "sede legale indirizzo"],
  sede_cap: ["cap", "codice postale"],
  sede_comune: ["comune", "citta", "localita", "comune sede"],
  sede_provincia: ["provincia", "prov", "sigla provincia"],
  ateco: ["ateco", "codice ateco", "codice attivita", "attivita ateco"],
  capitale_sociale: ["capitale sociale", "capitale"],
  lr_nome: ["nome", "nome legale rappresentante"],
  lr_cognome: ["cognome", "cognome legale rappresentante"],
  lr_codice_fiscale: ["codice fiscale legale rappresentante", "cf legale rappresentante", "codice fiscale rappresentante"],
  lr_data_nascita: ["data di nascita", "data nascita", "nato il", "nata il"],
  lr_luogo_nascita: ["luogo di nascita", "comune di nascita", "luogo nascita", "nato a", "nata a"],
  lr_documento_tipo: ["tipo documento", "tipologia documento", "documento di identita", "tipo di documento"],
  lr_documento_numero: ["numero documento", "n documento", "estremi documento", "numero del documento"],
  lr_documento_rilascio: ["data rilascio", "data di rilascio", "rilasciato il"],
  lr_documento_scadenza: ["data scadenza", "data di scadenza", "scadenza documento"],
  lr_documento_ente: ["rilasciato da", "ente rilascio", "autorita di rilascio", "ente di rilascio"],
};

// Plain ES5 source (not Function#toString: bundlers inject helpers that don't exist on the portal page).
// Called with data=null it returns { norm, pick } so scripts/check-bookmarklet.ts can test the matching.
export const RUNTIME = String.raw`function (data, syn) {
  function norm(s) {
    return String(s || "").replace(/([a-z])([A-Z])/g, "$1 $2").normalize("NFD")
      .replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function pick(text) {
    var padded = " " + text + " ", best = "", bestLen = 0;
    for (var f in syn) for (var j = 0; j < syn[f].length; j++) {
      var s = syn[f][j];
      if (s.length > bestLen && padded.indexOf(" " + s + " ") >= 0) { best = f; bestLen = s.length; }
    }
    if (!best) return null;
    if (best === "codice_fiscale" && /\b(legale rappresentante|rappresentante|titolare|nato|nata|nascita)\b/.test(text)) return "lr_codice_fiscale";
    if (best.indexOf("sede_") === 0 && /\b(nascita|residenza)\b/.test(text)) return null;
    return best;
  }
  if (!data) return { norm: norm, pick: pick };

  var dateFields = ["data_costituzione", "lr_data_nascita", "lr_documento_rilascio", "lr_documento_scadenza"];
  function parts(v) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
    if (m) return [m[1], m[2], m[3]];
    m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(v);
    return m ? [m[3], m[2], m[1]] : null;
  }
  function pad(n) { return n.length < 2 ? "0" + n : n; }
  function text(el) { return el ? el.textContent || "" : ""; }
  function matchText(el, doc) {
    var bits = [el.id, el.name, el.placeholder, el.getAttribute("aria-label"), el.title];
    var lb = el.getAttribute("aria-labelledby");
    if (lb) lb.split(/\s+/).forEach(function (id) { bits.push(text(doc.getElementById(id))); });
    if (el.id) bits.push(text(doc.querySelector('label[for="' + el.id.replace(/"/g, '\\"') + '"]')));
    bits.push(text(el.closest("label")));
    var cell = el.closest("td,th");
    if (cell) bits.push(text(cell.previousElementSibling), text(cell));
    var prev = el.previousElementSibling;
    while (prev && !text(prev).trim()) prev = prev.previousElementSibling;
    bits.push(text(prev));
    var parentText = text(el.parentElement);
    if (parentText.length < 100) bits.push(parentText);
    return norm(bits.join(" "));
  }
  function setValue(el, v) {
    var desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
    if (desc && desc.set) desc.set.call(el, v); else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  var docs = [document];
  Array.prototype.forEach.call(document.querySelectorAll("iframe"), function (f) {
    try { if (f.contentDocument) docs.push(f.contentDocument); } catch (e) { /* cross-origin */ }
  });
  var filled = [];
  docs.forEach(function (doc) {
    Array.prototype.forEach.call(doc.querySelectorAll("input,textarea,select"), function (el) {
      var type = (el.getAttribute("type") || "text").toLowerCase();
      if (/^(hidden|password|file|checkbox|radio|submit|button|reset|image)$/.test(type)) return;
      if (el.disabled || el.readOnly || el.value || !el.getClientRects().length) return;
      var field = pick(matchText(el, doc));
      var v = field ? String(data[field] || "") : "";
      if (!v) return;
      var p = dateFields.indexOf(field) >= 0 ? parts(v) : null;
      if (p) v = type === "date" ? p[0] + "-" + pad(p[1]) + "-" + pad(p[2]) : pad(p[2]) + "/" + pad(p[1]) + "/" + p[0];
      if (el.tagName === "SELECT") {
        var want = norm(v), opts = Array.prototype.slice.call(el.options);
        var opt = opts.filter(function (o) { return norm(o.value) === want || norm(o.text) === want; })[0];
        if (!opt && want.length > 1) opt = opts.filter(function (o) { return norm(o.text).indexOf(want) === 0; })[0];
        if (!opt) return;
        v = opt.value;
      }
      setValue(el, v);
      el.style.outline = "2px solid #12b76a";
      filled.push(el);
    });
  });
  setTimeout(function () { filled.forEach(function (el) { el.style.outline = ""; }); }, 4000);
  alert("Compilati " + filled.length + " campi");
}`;

export function buildBookmarklet(data: Anagrafica): string {
  return "javascript:" + encodeURIComponent(`(${RUNTIME})(${JSON.stringify(data)},${JSON.stringify(SYNONYMS)})`);
}
