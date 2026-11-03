// Run: npx tsx scripts/check-bandi-camere.ts
import assert from "node:assert/strict";
import { isOwnChamber, parseBando, regionForEnte } from "../lib/sources/bandi-camere";

assert.deepEqual(regionForEnte("CCIAA di Roma"), ["Lazio"]);
assert.deepEqual(regionForEnte("CCIAA di Reggio Emilia"), ["Emilia-Romagna"]); // non "Calabria" né "Lazio"
assert.deepEqual(regionForEnte("CCIAA di Reggio Calabria "), ["Calabria"]);
assert.deepEqual(regionForEnte("CCIAA Venezia Giulia Trieste Gorizia"), ["Friuli-Venezia Giulia"]); // non "Veneto"
assert.deepEqual(regionForEnte("CCIAA di Frosinone e Latina"), ["Lazio"]);
assert.deepEqual(regionForEnte("MIMIT "), ["ITALIA"]);
assert.deepEqual(regionForEnte("Ente sconosciuto"), []);

// le Camere già lette dai loro siti vengono scartate
assert.equal(isOwnChamber("CCIAA di Firenze"), true);
assert.equal(isOwnChamber("CCIAA di Pistoia-Prato"), true);
assert.equal(isOwnChamber("CCIAA Toscana Nord Ovest (Pisa, Lucca Massa Carrara) "), true);
assert.equal(isOwnChamber("CCIAA di Roma"), false);
assert.equal(isOwnChamber("Regione Toscana"), false);

// struttura reale di una scheda (ridotta)
const html = `<main><a href="https://www.linkedin.com/share">Linkedin</a><h1>MIMIT, Voucher Cloud &amp; Cybersecurity</h1>
<p>Ente: MIMIT Fondo / misura: Voucher Cloud &amp; Cybersecurity Il bando eroga contributi per cloud e cybersecurity</p>
<p>Il bando in breve Stato: in apertura Tipologia: Contributo a fondo perduto Importo erogato: fino a € 20.000
Periodo di presentazione: dal 10/11/2026 al 20/01/2027 Prima di presentare domanda</p>
<p>Importo del progetto minimo € 4.000 Contributo fino al 50% Categorie Digitalizzazione ed e-Commerce, Industria 4.0
Spese ammissibili Hardware / software, ICT Settori Commercio Beneficiari Ditta Individuale, Grande Impresa, PMI Cosa puoi finanziare</p>
<a href="https://www.mimit.gov.it/it/incentivi/cloud">ufficiale</a></main>`;
const g = parseBando(html, "https://www.bandicameredicommercio.it/bando/mimit-voucher-cloud-e-cybersecurity/")!;
assert.equal(g.id, "BCC-mimit-voucher-cloud-e-cybersecurity");
assert.equal(g.status, "In arrivo");
assert.equal(g.level, "Nazionale");
assert.deepEqual(g.regions, ["ITALIA"]);
assert.deepEqual([g.opening_date, g.deadline], ["2026-11-10", "2027-01-20"]);
assert.deepEqual(g.sizes.sort(), ["Grande", "Media", "Micro", "Piccola"]);
assert.equal(g.invest_min_eur, 4000);
assert.equal(g.aid_type, "Contributo a fondo perduto");
assert.equal(g.url, "https://www.mimit.gov.it/it/incentivi/cloud"); // pagina ufficiale, non i social
assert.ok(g.topics.includes("digitale") && g.topics.includes("cybersecurity"));

console.log("check-bandi-camere: ok");
