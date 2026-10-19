// Self-check for lib/bookmarklet.ts — run with: npx tsx scripts/check-bookmarklet.ts
import assert from "node:assert/strict";
import { buildBookmarklet, RUNTIME, SYNONYMS } from "../lib/bookmarklet";

const { norm, pick: pickNorm, splitAddr, PROV } = new Function(`return (${RUNTIME})`)()(null, SYNONYMS);
const pick = (label: string) => pickNorm(norm(label));

assert.deepEqual(splitAddr("VIA DEL CORSO 12"), ["VIA DEL CORSO", "12"]);
assert.deepEqual(splitAddr("Piazza Duomo, n. 3/B"), ["Piazza Duomo", "3/B"]);
assert.deepEqual(splitAddr("LOCALITA' IL PIANO"), ["LOCALITA' IL PIANO", ""]);
assert.equal(PROV.SI, "SIENA");
assert.equal(Object.keys(PROV).length, 107);

assert.equal(pick("Partita IVA *"), "partita_iva");
assert.equal(pick("P.IVA"), "partita_iva");
assert.equal(pick("partitaIva"), "partita_iva");
assert.equal(pick("Codice fiscale impresa"), "codice_fiscale");
assert.equal(pick("Codice fiscale del legale rappresentante"), "lr_codice_fiscale");
assert.equal(pick("Codice fiscale titolare"), "lr_codice_fiscale");
assert.equal(pick("Ragione sociale"), "denominazione");
assert.equal(pick("Indirizzo PEC"), "pec");
assert.equal(pick("Cognome"), "lr_cognome");
assert.equal(pick("Nome"), "lr_nome");
assert.equal(pick("Comune di nascita"), "lr_luogo_nascita");
assert.equal(pick("Provincia di nascita"), null);
assert.equal(pick("Città"), "sede_comune");
assert.equal(pick("Numero REA"), "rea");
assert.equal(pick("Codice attività (ATECO)"), "ateco");
assert.equal(pick("Note aggiuntive"), null);

const url = buildBookmarklet({ partita_iva: "01234567890", denominazione: 'Rossi "&" Figli </script>' });
assert.ok(url.startsWith("javascript:"));
const src = decodeURIComponent(url.slice("javascript:".length));
assert.ok(src.includes("01234567890"));
// Run the whole bookmarklet against an empty fake page: catches syntax errors and undefined references.
let alerted = "";
new Function("document", "setTimeout", "alert", src)({ querySelectorAll: () => [] }, () => 0, (m: string) => (alerted = m));
assert.equal(alerted, "Compilati 0 campi");

console.log("bookmarklet OK,", url.length, "chars");
