// Run: npx tsx scripts/check-visura.ts
import assert from "node:assert/strict";
import { cfCognome, cfNome, dataNascitaDaCf, parseVisura, splitNome } from "../lib/visura";

assert.equal(cfCognome("Rossi"), "RSS");
assert.equal(cfNome("Mario"), "MRA");
assert.equal(cfNome("Gianfranco"), "GFR"); // 4+ consonants: 1st, 3rd, 4th
assert.equal(cfCognome("Fo"), "FOX");
assert.equal(dataNascitaDaCf("RSSMRA70A41H501X"), "1970-01-01"); // female day +40
assert.deepEqual(splitNome("AMMINISTRATORE UNICO DE LUCA MARIO", "DLCMRA80C15F205X"), { cognome: "DE LUCA", nome: "MARIO" });

const visura = `Camera di Commercio Industria Artigianato e Agricoltura di ROMA
VISURA ORDINARIA SOCIETA' DI CAPITALE
ALFA SERVIZI S.R.L.
DATI ANAGRAFICI
Indirizzo Sede legale ROMA (RM) VIA DEL CORSO 12 CAP 00186
Indirizzo PEC ALFASERVIZI@LEGALMAIL.IT
Numero REA RM - 1234567
Codice fiscale e n.iscr. al Registro Imprese 01234567890
Partita IVA 01234567890
Forma giuridica societa' a responsabilita' limitata
Data atto di costituzione 15/03/2012
Capitale sociale in Euro Deliberato: 10.000,00
Codice ATECO 62.01 - produzione di software non connesso all'edizione
Amministratori
Amministratore Unico
DE LUCA MARIO
Nato a MILANO (MI) il 15/03/1980
Codice fiscale: DLCMRA80C15F205X`;

assert.deepEqual(parseVisura(visura), {
  denominazione: "ALFA SERVIZI S.R.L.",
  partita_iva: "01234567890",
  codice_fiscale: "01234567890",
  forma_giuridica: "societa' a responsabilita' limitata",
  pec: "alfaservizi@legalmail.it",
  rea: "RM - 1234567",
  data_costituzione: "2012-03-15",
  ateco: "62.01",
  capitale_sociale: "10.000,00",
  sede_comune: "ROMA",
  sede_provincia: "RM",
  sede_indirizzo: "VIA DEL CORSO 12",
  sede_cap: "00186",
  lr_codice_fiscale: "DLCMRA80C15F205X",
  lr_cognome: "DE LUCA",
  lr_nome: "MARIO",
  lr_luogo_nascita: "MILANO (MI)",
  lr_data_nascita: "1980-03-15",
});
assert.deepEqual(parseVisura("testo senza etichette"), {});

console.log("visura OK");
