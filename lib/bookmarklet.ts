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
  iban: ["iban", "codice iban"],
  iban_intestatario: ["intestatario", "intestatario iban", "intestatario conto", "intestatario del conto"],
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
  var PROV = {};
  ("AG:AGRIGENTO|AL:ALESSANDRIA|AN:ANCONA|AO:AOSTA|AR:AREZZO|AP:ASCOLI PICENO|AT:ASTI|AV:AVELLINO|BA:BARI|BT:BARLETTA-ANDRIA-TRANI|" +
   "BL:BELLUNO|BN:BENEVENTO|BG:BERGAMO|BI:BIELLA|BO:BOLOGNA|BZ:BOLZANO|BS:BRESCIA|BR:BRINDISI|CA:CAGLIARI|CL:CALTANISSETTA|" +
   "CB:CAMPOBASSO|CE:CASERTA|CT:CATANIA|CZ:CATANZARO|CH:CHIETI|CO:COMO|CS:COSENZA|CR:CREMONA|KR:CROTONE|CN:CUNEO|EN:ENNA|FM:FERMO|" +
   "FE:FERRARA|FI:FIRENZE|FG:FOGGIA|FC:FORLI'-CESENA|FR:FROSINONE|GE:GENOVA|GO:GORIZIA|GR:GROSSETO|IM:IMPERIA|IS:ISERNIA|SP:LA SPEZIA|" +
   "AQ:L'AQUILA|LT:LATINA|LE:LECCE|LC:LECCO|LI:LIVORNO|LO:LODI|LU:LUCCA|MC:MACERATA|MN:MANTOVA|MS:MASSA-CARRARA|MT:MATERA|ME:MESSINA|" +
   "MI:MILANO|MO:MODENA|MB:MONZA E DELLA BRIANZA|NA:NAPOLI|NO:NOVARA|NU:NUORO|OR:ORISTANO|PD:PADOVA|PA:PALERMO|PR:PARMA|PV:PAVIA|" +
   "PG:PERUGIA|PU:PESARO E URBINO|PE:PESCARA|PC:PIACENZA|PI:PISA|PT:PISTOIA|PN:PORDENONE|PZ:POTENZA|PO:PRATO|RG:RAGUSA|RA:RAVENNA|" +
   "RC:REGGIO CALABRIA|RE:REGGIO EMILIA|RI:RIETI|RN:RIMINI|RM:ROMA|RO:ROVIGO|SA:SALERNO|SS:SASSARI|SV:SAVONA|SI:SIENA|SR:SIRACUSA|" +
   "SO:SONDRIO|SU:SUD SARDEGNA|TA:TARANTO|TE:TERAMO|TR:TERNI|TO:TORINO|TP:TRAPANI|TN:TRENTO|TV:TREVISO|TS:TRIESTE|UD:UDINE|VA:VARESE|" +
   "VE:VENEZIA|VB:VERBANO-CUSIO-OSSOLA|VC:VERCELLI|VR:VERONA|VV:VIBO VALENTIA|VI:VICENZA|VT:VITERBO").split("|")
    .forEach(function (p) { PROV[p.slice(0, 2)] = p.slice(3); });
  // "VIA DEL CORSO 12/A" -> ["VIA DEL CORSO", "12/A"]
  function splitAddr(s) {
    var m = /^(.*?)[\s,]+(?:n\.?\s*)?(\d+\s*[a-z]?(?:\/\s*\w+)*)$/i.exec(String(s || "").trim());
    return m ? [m[1], m[2].replace(/\s+/g, "")] : [String(s || "").trim(), ""];
  }
  if (!data) return { norm: norm, pick: pick, splitAddr: splitAddr, PROV: PROV };

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

  function mark(el) {
    el.style.outline = "2px solid #12b76a";
    setTimeout(function () { el.style.outline = ""; }, 4000);
  }
  function wait(test, ms) {
    return new Promise(function (resolve) {
      var start = Date.now();
      (function loop() {
        var r = test();
        if (r || Date.now() - start > ms) resolve(r); else setTimeout(loop, 150);
      })();
    });
  }
  // ngb-typeahead: type, wait for the suggestion list, click the matching entry (the form only accepts list picks)
  function typeahead(el, v) {
    if (!el || !v) return Promise.resolve(false);
    if (el.value) return Promise.resolve("filled");
    return wait(function () { return !el.disabled; }, 8000).then(function (enabled) {
      if (!enabled) return null;
      el.focus();
      setValue(el, v);
      return wait(function () {
        var w = document.getElementById(el.getAttribute("aria-owns") || "") || document.querySelector("ngb-typeahead-window");
        return w && w.querySelector("button") ? w : null;
      }, 5000);
    }).then(function (w) {
      if (!w) return false;
      var want = norm(v), btns = Array.prototype.slice.call(w.querySelectorAll("button"));
      var b = btns.filter(function (x) { return norm(x.textContent) === want; })[0] ||
        btns.filter(function (x) { return norm(x.textContent).indexOf(want) === 0; })[0] ||
        (btns.length === 1 ? btns[0] : null);
      if (!b) return false;
      b.click();
      mark(el);
      return true;
    });
  }

  // ReStart (InfoCamere): Angular form, mapped by formcontrolname. The intermediary's block uses the same names
  // (codiceFiscale, emailPec, telefono) earlier in the page, so the business's control is always the last match.
  var host = typeof location !== "undefined" ? location.hostname : "";
  if (/(^|\.)restart\.infocamere\.it$/.test(host)) {
    if (!document.getElementById("denominazione")) {
      alert("Apri lo step ANAGRAFICA della richiesta ReStart e riprova.");
      return;
    }
    var count = 0, missed = [];
    var fc = function (name) {
      var els = document.querySelectorAll('[formcontrolname="' + name + '"]');
      return els[els.length - 1] || null;
    };
    var put = function (el, v, label) {
      if (!v) return;
      if (!el || el.disabled) { missed.push(label); return; }
      if (el.value) return;
      setValue(el, v);
      mark(el);
      count++;
    };
    var choose = function (el, test, label) {
      // a disabled placeholder makes the browser preselect option 1, so trust Angular's pristine flag instead
      if (!el || (el.selectedIndex > 0 && !el.classList.contains("ng-pristine"))) return;
      var opt = Array.prototype.slice.call(el.options).filter(test)[0];
      if (!opt) { missed.push(label); return; }
      setValue(el, opt.value);
      mark(el);
      count++;
    };
    // declarant (intermediary) contacts are fixed; that block precedes the business block (#denominazione)
    var firstBefore = function (name) {
      var anchor = document.getElementById("denominazione");
      return Array.prototype.filter.call(document.querySelectorAll('[formcontrolname="' + name + '"]'), function (el) {
        return el.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING;
      })[0] || null;
    };
    put(firstBefore("emailContatto"), "segreteria@vivarelliconsulting.com", "Email di contatto dichiarante");
    put(firstBefore("telefono"), "3484935923", "Telefono dichiarante");

    var addr = splitAddr(data.sede_indirizzo);
    put(fc("denominazione"), data.denominazione, "Denominazione");
    put(fc("codiceFiscale"), data.codice_fiscale, "Codice fiscale");
    put(fc("partitaIVA"), data.partita_iva, "Partita IVA");
    put(fc("emailPec"), data.pec, "PEC");
    put(fc("confermaEmailPec"), data.pec, "Conferma PEC");
    put(fc("indirizzoSede"), addr[0], "Indirizzo");
    put(fc("numeroCivicoSede"), addr[1], "N. civico");
    var size = { micro: "1", piccola: "2", media: "3", grande: "4" }[norm(data.dimensione).split(" ")[0]];
    if (size) choose(fc("dimensioneImpresaCodice"), function (o) { return o.value === size; }, "Dimensione impresa");
    var settore = fc("codSettore");
    if (settore && settore.options.length === 2) choose(settore, function (o, i) { return i === 1; }, "Settore");
    // always bonifico; the only option is shown selected but the Angular control stays empty until a change event
    choose(fc("tipoPagamento"), function (o) { return norm(o.text) === "bonifico"; }, "Modalità di pagamento");

    var sigla = String(data.sede_provincia || "").toUpperCase();
    var steps = [
      [document.getElementById("provinciaSede"), PROV[sigla] || sigla, "Provincia"],
      [document.getElementById("comuneSedeASD"), data.sede_comune, "Comune"],
      [document.getElementById("capSede"), data.sede_cap, "CAP"],
    ];
    steps.reduce(function (p, s) {
      return p.then(function (ok) {
        if (!ok || !s[1]) { if (s[1]) missed.push(s[2]); return false; }
        return typeahead(s[0], s[1]).then(function (done) { if (done === true) count++; else if (!done) missed.push(s[2]); return done; });
      });
    }, Promise.resolve(true)).then(function () {
      // the IBAN block (formGroupName "cc") is rendered only after "Bonifico" is chosen
      if (!data.iban) return;
      return wait(function () { return fc("codiceIban"); }, 3000).then(function () {
        put(fc("denominazioneIntestatario"), String(data.iban_intestatario || "").toUpperCase(), "Intestatario IBAN");
        put(fc("codiceIban"), data.iban, "IBAN");
        put(fc("confermaCodiceIban"), data.iban, "Conferma IBAN");
      });
    }).then(function () {
      alert("ReStart: compilati " + count + " campi." +
        (missed.length ? "\nDa completare a mano: " + missed.join(", ") : "") +
        "\nTelefono dell'impresa e dichiarazioni vanno inseriti a mano.");
    });
    return;
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

// dimensione comes from the customer record (Micro/Piccola/Media/Grande), used by portal-specific mappings
export function buildBookmarklet(data: Anagrafica & { dimensione?: string }): string {
  return "javascript:" + encodeURIComponent(`(${RUNTIME})(${JSON.stringify(data)},${JSON.stringify(SYNONYMS)})`);
}
