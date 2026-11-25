// Self-check offline per lib/ateco.ts e l'esclusione per ATECO — run: npx tsx scripts/check-ateco.ts
import assert from "node:assert/strict";
import { atecoAmmesso, codiciBando, codiciCliente } from "../lib/ateco";
import { scoreAll, scoreGrant } from "../lib/scoring";
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
  ({ regions: ["ITALIA"], sizes: ["*"], ateco_filter, topics: [], invest_min_eur: null, invest_max_eur: null, status: "Aperto", deadline: null }) as unknown as Grant;
const vietato = bando(["55.1"]);
assert.ok(scoreGrant(cliente, vietato).score_totale >= 50); // il solo punteggio non basta a escluderlo
assert.deepEqual(scoreAll(cliente, [vietato, bando(["56"]), bando(["*"])]).map((m) => m.grant.ateco_filter[0]), ["56", "*"]);
// ATECO presente solo nella visura
assert.equal(scoreGrant({ ...cliente, ateco: null, anagrafica: { ateco: "56.30.01" } }, vietato).ateco_escluso, true);
// senza ATECO il bando non si esclude, ma non prende i punti
const ignoto = scoreGrant({ ...cliente, ateco: null }, vietato);
assert.equal(ignoto.ateco_escluso, false);
assert.equal(ignoto.score_ateco, 0);
assert.equal(scoreGrant({ ...cliente, ateco: null }, bando(["*"])).score_ateco, 15);

console.log("check-ateco: ok");
