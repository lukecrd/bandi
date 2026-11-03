// Run: npx tsx scripts/check-camcom.ts
import assert from "node:assert/strict";
import { NOT_A_BANDO, parseDetailDates, parseSlashDate } from "../lib/sources/camcom";

// Toscana Nord-Ovest, testo reale della scheda "Doppia Transizione – II edizione 2026"
assert.deepEqual(
  parseDetailDates("attraverso il sistema Restart di Infocamere dalle ore 10 del 20 Ottobre 2026 fino alle ore 18 del 26 Ottobre 2026 , utilizzando"),
  { opening: "2026-10-20", deadline: "2026-10-26" }
);
// Pistoia-Prato: la sezione "Quando presentare domanda" vince sulle altre date della pagina
assert.deepEqual(
  parseDetailDates("attività da concludere entro il 30/09/2027. Quando presentare domanda La domanda deve essere inviata dalle ore 10:00 dell'11/11/2026 e non oltre le ore 23:59 del 30/11/2026."),
  { opening: "2026-11-11", deadline: "2026-11-30" }
);
assert.deepEqual(
  parseDetailDates("Quando presentare domanda La domanda deve essere inviata a partire dalle ore ore 18:00 del 19/10/2026 fino alle ore 23:59 del 12/11/2026."),
  { opening: "2026-10-19", deadline: "2026-11-12" }
);
assert.deepEqual(
  parseDetailDates("Quando presentare la domanda Le imprese possono presentare la domanda dalle ore 18:00 del giorno 21 settembre 2026 alle ore 23:59 del giorno 1 ottobre 2026 ."),
  { opening: "2026-09-21", deadline: "2026-10-01" }
);
assert.deepEqual(parseDetailDates("domande dal 01/10/2026 al 30/11/2026."), { opening: "2026-10-01", deadline: "2026-11-30" });
assert.deepEqual(parseDetailDates("da presentare entro il 15/12/2026"), { opening: null, deadline: "2026-12-15" });
// "entro 120 gg" non è una data
assert.deepEqual(parseDetailDates("rendicontazione da farsi entro entro 120 gg dalla data"), { opening: null, deadline: null });
assert.deepEqual(parseDetailDates(null), { opening: null, deadline: null });
// Roma scrive le date con il trattino
assert.equal(parseSlashDate("18-12-2026"), "2026-12-18");
assert.equal(parseSlashDate("ore 16:00 del 1/12/2026"), "2026-12-01");

// avvisi di Roma che non sono bandi di contributo
for (const title of [
  "Bando Voucher Doppia Transizione Digitale e Ecologica 2025 - Provvedimenti di liquidazione",
  "Bando per il sostegno alla competitività delle imprese 2026 - I edizione. Graduatoria e Provvedimento di concessione del contributo",
  "Avviso per la riapertura delle iscrizioni al Registro delle Imprese Storiche Italiane - Anno 2026",
  "Bando pubblico per l'indizione delle sessioni di esame per l'anno 2026 Ruolo Conducenti",
  "Servizi di mediazione e di arbitrato - Avviso pubblico per l'iscrizione nell'Elenco dei mediatori",
]) assert.ok(NOT_A_BANDO.test(title), title);
for (const title of ["Bando ITS Academy 2026", "Bando Nuove Imprese 2026", "Bando Idea innovativa, la nuova imprenditorialità al femminile 2026"])
  assert.ok(!NOT_A_BANDO.test(title), title);

console.log("check-camcom: ok");
