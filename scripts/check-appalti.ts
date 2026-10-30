// Run: npx tsx scripts/check-appalti.ts
import assert from "node:assert/strict";
import { mapAnacAvviso, mapTedNotice, placesToRegions } from "../lib/sources/appalti";

assert.deepEqual(placesToRegions(["ITI13", "ITI17"]), ["Toscana"]); // NUTS3 TED
assert.deepEqual(placesToRegions(["Reggio nell'Emilia", "Forlì-Cesena"]), ["Emilia-Romagna"]); // province ANAC
assert.deepEqual(placesToRegions(["Friuli-Venezia Giulia"]), ["Friuli Venezia Giulia"]);
assert.deepEqual(placesToRegions(["ITALIA"]), ["ITALIA"]);
assert.deepEqual(placesToRegions(["ALZZ"]), []);

const ted = mapTedNotice({
  "publication-number": "722818-2026",
  "title-proc": { ita: "Servizi assicurativi" },
  "contract-nature-main-proc": "services",
  "deadline-receipt-tender-date-lot": ["2026-10-01+01:00", "2026-11-10+01:00"],
  "place-of-performance-subdiv-lot": ["ITI13"],
  "estimated-value-lot": ["324000.00"],
}, "2026-10-30");
assert.equal(ted?.deadline, "2026-11-10"); // prima scadenza di lotto ancora aperta
assert.deepEqual(ted?.regions, ["Toscana"]);
assert.equal(ted?.aid_type, "Gara d'appalto - Servizi");
assert.equal(mapTedNotice({ "publication-number": "1", "deadline-receipt-tender-date-lot": ["2026-10-01"] }, "2026-10-30"), null);

const avviso = (ted: string | null, scadenza: string) => ({
  idAvviso: "x", codiceScheda: "P1_16", tipologia: "BANDI", dataScadenza: scadenza,
  templates: [{ template: {
    metadata: { link_eform_ted: ted, titolo: null, descrizione: "Gestione asilo nido" },
    sections: [{ name: "C", items: [{ luogo_nuts: "Sondrio", natura_principale: "Servizi", valore_complessivo_stimato: 994000 }] }],
  } }],
});
assert.deepEqual(mapAnacAvviso(avviso(null, "2026-12-01T00:00:00Z"), "2026-10-30")?.regions, ["Lombardia"]);
assert.equal(mapAnacAvviso(avviso("https://ted.europa.eu/x", "2026-12-01T00:00:00Z"), "2026-10-30"), null); // già da TED
assert.equal(mapAnacAvviso(avviso(null, "2026-10-01T00:00:00Z"), "2026-10-30"), null); // scaduta

console.log("check-appalti: ok");
