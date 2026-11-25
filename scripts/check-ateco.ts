// Self-check offline per lib/ateco.ts e l'esclusione per ATECO — run: npx tsx scripts/check-ateco.ts
import assert from "node:assert/strict";
import { atecoAmmesso, codiciBando, codiciCliente } from "../lib/ateco";
import { scoreAll, scoreGrant } from "../lib/scoring";
import { settoriBandIntelligence, settoriContributiEuropa, settoriDaTitolo, settoriIncentivi, soloNonImprese } from "../lib/settori";
import { datiMancanti } from "../lib/questionario";
import { mapDoc } from "../lib/sources/incentivi";
import type { Customer, Grant } from "../lib/types";

// valori reali del campo libero dei clienti
assert.deepEqual(codiciCliente("43.21.0,43.21.02"), ["4321"]);
assert.deepEqual(codiciCliente("50.1/33.15/52.22.09/93.19.99"), ["501", "3315", "5222", "9319"]);
assert.deepEqual(
  codiciCliente("52.10.152.21.645.11.0281.29.9145.11.0145.19.0145.3245.40.1145.40.2147.91.1"),
  ["521", "5221", "4511", "8129", "4519", "4532", "454", "4791"]
);
assert.deepEqual(codiciCliente("432409"), ["4324"]);
assert.deepEqual(codiciCliente("47"), ["47"]);
assert.deepEqual(codiciCliente(null), []);

assert.deepEqual(codiciBando("ATECO 2025: 01.00; 55.10; 10; 47.91.1; 20.15;"), ["01", "55.1", "10", "47.911", "20.15"]);
assert.deepEqual(codiciBando("Tutti i settori economici ammissibili a ricevere aiuti;"), ["*"]);
assert.deepEqual(codiciBando("55.10; esclusi i bar"), ["*"]);
assert.deepEqual(codiciBando(null), ["*"]);

assert.equal(atecoAmmesso(codiciCliente("56.30.01"), codiciBando("55.10; 56.30")), true);
assert.equal(atecoAmmesso(codiciCliente("56.30.01"), codiciBando("56.00")), true);
assert.equal(atecoAmmesso(codiciCliente("56.30.01"), codiciBando("55.10; 56.10")), false);
assert.equal(atecoAmmesso(codiciCliente("47"), codiciBando("47.91")), true);
assert.equal(atecoAmmesso(codiciCliente("10.71"), codiciBando("01.00")), false);
assert.equal(atecoAmmesso([], codiciBando("55.10")), null);
assert.equal(atecoAmmesso(["5630"], ["*"]), null);

const cliente = { regione: "Toscana", dimensione: "Micro", ateco: "56.30.01", anagrafica: {}, investimento_previsto_eur: null } as Customer;
const bando = (ateco_filter: string[]) =>
  ({ title: "Bando di prova", regions: ["ITALIA"], sizes: ["*"], ateco_filter, topics: [], invest_min_eur: null, invest_max_eur: null, status: "Aperto", deadline: null }) as unknown as Grant;
const vietato = bando(["55.1"]);
assert.ok(scoreGrant(cliente, vietato).score_totale >= 50); // il solo punteggio non basta a escluderlo
assert.deepEqual(scoreAll(cliente, [vietato, bando(["56"]), bando(["*"])]).map((m) => m.grant.ateco_filter[0]), ["56"]); // il generico non si propone
// ATECO presente solo nella visura
assert.equal(scoreGrant({ ...cliente, ateco: null, anagrafica: { ateco: "56.30.01" } }, vietato).esclusioni.length, 1);
// senza ATECO restano solo i bandi per tutti i settori
assert.deepEqual(scoreGrant({ ...cliente, ateco: null }, vietato).esclusioni, ["riservato a settori, ATECO del cliente mancante"]);
assert.deepEqual(scoreGrant({ ...cliente, ateco: null }, bando(["*"])).esclusioni, []);
// il bando del settore vale più di quello generico
assert.ok(scoreGrant(cliente, bando(["56"])).score_totale > scoreGrant(cliente, bando(["*"])).score_totale);
assert.deepEqual(scoreGrant(cliente, bando(["56"])).motivi, ["settore ATECO 56"]);
assert.deepEqual(scoreGrant(cliente, bando(["*"])).motivi, []);
assert.deepEqual(scoreGrant({ ...cliente, digitale: true }, { ...bando(["*"]), topics: ["digitale"] }).motivi, ["digitale"]);
assert.deepEqual(scoreGrant({ ...cliente, provincia: "FI" }, { ...bando(["*"]), ente: "CCIAA Firenze" }).motivi, ["Camera di Commercio della sua provincia"]);
// elenco di mezza economia: ammesso, ma non è un motivo
assert.deepEqual(scoreGrant(cliente, bando(Array.from({ length: 40 }, (_, i) => String(i + 20)))).motivi, []);
assert.deepEqual(datiMancanti({ ...cliente, provincia: null, dipendenti: null, fatturato_eur: null, ateco: null } as Customer), ["territorio", "dimensione", "ATECO", "temi"]);
assert.deepEqual(datiMancanti({ ...cliente, provincia: "GR", dipendenti: 3, fatturato_eur: null, digitale: true } as Customer), []);

const motivi = (g: Partial<Grant>, c: Partial<Customer> = {}) => scoreGrant({ ...cliente, ...c } as Customer, { ...bando(["*"]), ...g } as Grant).esclusioni;
assert.deepEqual(motivi({ regions: ["Lazio"] }), ["altra regione"]);
assert.deepEqual(motivi({ regions: ["Lazio"] }, { regione: "Toscana, Lazio" }), []);
assert.deepEqual(motivi({ sizes: ["ente pubblico"] }), ["altri beneficiari"]);
assert.deepEqual(motivi({ ente: "COMUNE DI TREVIGLIO" }), ["solo imprese del Comune"]);
assert.deepEqual(motivi({ ente: "Comune di Treviglio" }, { anagrafica: { sede_comune: "TREVIGLIO" } }), []);
// province: Camere di Commercio, e regione ricavata quando manca
const camera = "Camera di Commercio, Industria, Artigianato e Agricoltura di Firenze";
assert.deepEqual(motivi({ ente: camera }, { provincia: "GROSSETO" }), ["Camera di Commercio di altra provincia"]);
assert.deepEqual(motivi({ ente: camera }, { provincia: "FI" }), []);
assert.deepEqual(motivi({ ente: camera }, { provincia: null }), []);
assert.deepEqual(motivi({ ente: "Camera di Commercio Maremma e Tirreno" }, { provincia: "GR" }), []);
assert.deepEqual(motivi({ ente: "CCIAA Roma" }, { provincia: "Roma" }), []);
assert.deepEqual(motivi({ ente: "Camera di Commercio della Romagna Forlì Cesena e Rimini" }, { provincia: "Roma" }), ["Camera di Commercio di altra provincia"]);
assert.deepEqual(motivi({ ente: "Camera di Commercio I.A.A. Frosinone-Latina" }, { provincia: "Latina" }), []);
assert.deepEqual(motivi({ ente: null, title: "CCIAA di Brescia. Finanziamento a fondo perduto" }, { provincia: "Siena" }), ["Camera di Commercio di altra provincia"]);
assert.deepEqual(motivi({ ente: "Unione Regionale Delle Camere di Commercio della Lombardia" }, { provincia: "Milano" }), []);
assert.deepEqual(motivi({ regions: ["Toscana"] }, { regione: "", provincia: "MASSA-CARRARA" }), []);
assert.deepEqual(motivi({ regions: ["Toscana"] }, { regione: "", provincia: null }), ["altra regione"]);
assert.deepEqual(motivi({ level: "UE", topics: ["R&S"] }), ["call UE senza temi in comune"]);
assert.deepEqual(motivi({ level: "UE", topics: ["R&S"] }, { ricerca_sviluppo: true }), ["call UE senza temi in comune"]);
assert.deepEqual(motivi({ level: "UE", topics: ["R&S", "digitale"] }, { ricerca_sviluppo: true, digitale: true }), []);
assert.deepEqual(motivi({ invest_min_eur: 50000 }, { investimento_previsto_eur: 10000 }), ["investimento sotto il minimo"]);
// "ai" non deve scattare dentro "aiuti"
assert.equal(scoreGrant({ ...cliente, digitale: true }, { ...bando(["*"]), topics: ["aiuti"] }).score_temi, 0);

assert.deepEqual(settoriIncentivi(["Alberghiero", "Ristorazione"]), ["55", "56"]);
assert.deepEqual(settoriIncentivi(["Commercio", "Altri servizi"]), ["*"]);
assert.deepEqual(settoriIncentivi([]), ["*"]);
assert.deepEqual(settoriContributiEuropa(["agricoltura", "pesca"]), ["03"]);
assert.deepEqual(settoriContributiEuropa(["servizi", "audiovisivo media cinema"]), ["59", "60"]);
assert.deepEqual(settoriContributiEuropa(["turismo", "voce mai vista"]), ["*"]);
assert.deepEqual(settoriContributiEuropa(["agricoltura", "agroindustria", "artigianato", "industria", "commercio", "turismo", "cultura", "servizi"]), ["*"]);
assert.deepEqual(settoriBandIntelligence("generale", "Contributi per le risorse genetiche agrarie"), ["01", "02", "03"]);
assert.deepEqual(settoriDaTitolo("Bando Sviluppo Impresa 2026"), ["*"]);
assert.equal(soloNonImprese("Bando parcheggi 2026 ; Contributi regionali della Toscana ai Comuni"), true);
assert.equal(soloNonImprese("Incentivi per enti pubblici locali, società pubbliche e PMI"), false);

const doc = { idBando: "1", Regioni: ["Toscana"], Dimensione_beneficiari: ["Microimpresa"], Codici_ATECO: "Tutti i settori economici ammissibili a ricevere aiuti;" };
const regioni = (Soggetto_Concedente: string, Regioni: string[]) => mapDoc({ ...doc, Soggetto_Concedente, Regioni }).regions;
assert.deepEqual(regioni("Regione Siciliana - Dipartimento regionale dell'Agricoltura", ["Sicilia"]), ["Sicilia"]);
assert.deepEqual(regioni("Ministero delle Imprese", ["Sardegna"]), ["Sardegna"]);
assert.deepEqual(regioni("Ministero delle Imprese", []), ["ITALIA"]);
assert.deepEqual(regioni("SIMEST", Array.from({ length: 20 }, (_, i) => `R${i}`)), ["ITALIA"]);
assert.deepEqual(mapDoc({ ...doc, Tipologia_Soggetto: ["Ente Pubblico"] }).sizes, ["Ente Pubblico"]);
assert.deepEqual(mapDoc({ ...doc, Tipologia_Soggetto: ["Impresa", "Ente Pubblico"] }).sizes, ["Microimpresa"]);
assert.deepEqual(mapDoc({ ...doc, Settore_Attivita: ["Agricoltura, silvicoltura e pesca"] }).ateco_filter, ["01", "02", "03"]);
assert.deepEqual(mapDoc({ ...doc, Settore_Attivita: ["Cultura"], Codici_ATECO: "ATECO 2025: 59.11" }).ateco_filter, ["59.11"]);

console.log("check-ateco: ok");
