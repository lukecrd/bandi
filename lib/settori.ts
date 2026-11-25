// Categorie di settore delle fonti -> divisioni ATECO (prime due cifre), per i bandi che non elencano i codici.

/** "01-03 10" -> ["01", "02", "03", "10"] */
function div(spec: string) {
  return spec.split(" ").flatMap((parte) => {
    const [da, a = da] = parte.split("-").map(Number);
    return Array.from({ length: a - da + 1 }, (_, i) => String(da + i).padStart(2, "0"));
  });
}

// Oltre questo numero di divisioni (su 88) il bando è di fatto aperto a tutti.
const QUASI_TUTTE = 60;

function filtro(divisioni: string[]) {
  const uniche = [...new Set(divisioni)].sort();
  return uniche.length && uniche.length < QUASI_TUTTE ? uniche : ["*"];
}

const AGRICOLTURA = "01-03";
const TURISMO = "55-56 79 90-91 93";
const SPETTACOLO = "59-60 90";
// Attività tipicamente artigiane: manifattura, edilizia, riparazioni, trasporto persone, servizi alla persona.
const ARTIGIANATO = "10-33 41-43 45 49 56 62 74 80-81 95-96";

const INCENTIVI: Record<string, string> = {
  "Agricoltura, silvicoltura e pesca": AGRICOLTURA,
  Agroalimentare: "01-03 10-12",
  Alberghiero: "55",
  Artigianato: ARTIGIANATO,
  "Autoveicoli e altri mezzi di trasporto": "29-30 45",
  "Chimica e Farmaceutica": "19-22",
  Commercio: "45-47 56",
  Cultura: "58-60 90-91",
  Edilizia: "23 41-43 71",
  Elettronica: "26-27 33",
  "Fornitura Energia, Acqua e gestione Rifiuti": "35-39",
  ICT: "58 61-63",
  Meccanica: "25 28-30 33",
  Metallurgia: "24-25",
  "Mobili, Legno e Carta": "16-18 31",
  "Moda e Tessile": "13-15",
  Ristorazione: "56",
  Salute: "21 32 75 86-88",
  "Servizi di trasporto": "49-53",
  Turismo: TURISMO,
};

/** Settori di Incentivi.gov.it; "Altri servizi" o elenco vuoto non restringono nulla. */
export function settoriIncentivi(settori: string[]) {
  if (!settori.every((s) => INCENTIVI[s])) return ["*"];
  return filtro(settori.flatMap((s) => div(INCENTIVI[s])));
}

// Contributi Europa elenca insieme la categoria e le sue voci: se c'è una voce, la categoria da sola non allarga.
const CE: Record<string, { tutta: string; voci: Record<string, string> }> = {
  agricoltura: {
    tutta: AGRICOLTURA,
    voci: { allevamento: "01", apicoltura: "01", coltivazione: "01", silvicoltura: "02", pesca: "03" },
  },
  agroindustria: { tutta: "10-12", voci: {} },
  artigianato: { tutta: ARTIGIANATO, voci: {} },
  industria: { tutta: "05-39 41-43", voci: {} },
  commercio: {
    tutta: "45-47",
    voci: { "commercio al dettaglio": "45 47", "commercio allingrosso": "45-46", "commercio ambulante": "47" },
  },
  turismo: {
    tutta: TURISMO,
    voci: {
      "strutture ricettive alberghi villaggi turistici campeggi rifugi di montagna ecc": "55",
      "bar ristorazione": "56",
      "tour operator agenzie di viaggio": "79",
      "guide turistiche": "79",
    },
  },
  cultura: {
    tutta: "58-60 90-91",
    voci: { "attivita artistiche": "90", "teatro biblioteche archivi musei": "90-91" },
  },
  servizi: {
    tutta: "49-53 58-66 68-75 77-82 85-88 90-96",
    voci: {
      "altre tipologie di servizi": "61-63 68 72-75 77-78 80-82 94-96",
      "attivita di ricerca privata": "72",
      "attivita professionali consulenti studi legali commercialisti agenti ecc": "62 66 68-75",
      "assistenza sociale": "87-88",
      "audiovisivo media cinema": "59-60",
      consulenza: "62 69-74",
      "editoria informazione comunicazione": "18 58 60 63 73",
      formazione: "85",
      "istruzione privata": "85",
      sanita: "75 86",
      "servizi alla persona": "96",
      "servizi bancari assicurativi finanziari": "64-66",
      "sport intrattenimento": "90 92-93",
      trasporti: "49-53",
    },
  },
  pubblico: {
    tutta: "84",
    voci: {
      "altre tipologie di attivita svolte da enti pubblici": "84",
      "amministrazione pubblica": "84",
      "sanita e assistenza sociale pubblica": "84",
      "istruzione scolastica pubblica": "84",
      "istruzione universitaria pubblica": "84",
      "enti di ricerca pubblico": "84",
    },
  },
};

export function settoriContributiEuropa(settori: string[]) {
  const presenti = new Set(settori);
  const trovate = new Set<string>();
  const divisioni = Object.entries(CE).flatMap(([categoria, { tutta, voci }]) => {
    const foglie = Object.keys(voci).filter((v) => presenti.has(v));
    foglie.forEach((v) => trovate.add(v));
    if (presenti.has(categoria)) trovate.add(categoria);
    return foglie.length ? foglie.flatMap((v) => div(voci[v])) : presenti.has(categoria) ? div(tutta) : [];
  });
  // una categoria nuova del sito non deve far sparire bandi
  return trovate.size === presenti.size ? filtro(divisioni) : ["*"];
}

// Per le fonti senza settori strutturati: solo parole che nel titolo indicano un comparto senza ambiguità.
const TITOLI: [RegExp, string][] = [
  [/\bCSR\b|\bS?R[A-H]\d{2}|agricol|agrar|viticol|zootecn|forestal/i, AGRICOLTURA],
  [/\bpesca\b|acquacolt/i, "03"],
  [/cinema|audiovisiv|spettacolo/i, SPETTACOLO],
  [/automotive/i, "22-33 45"],
  [/\bmoda\b|tessil/i, "13-15"],
  [/turis|ricettiv/i, TURISMO],
  [/portual/i, "50 52"],
  [/\bedicol/i, "46-47"],
  [/\btaxi\b/i, "49"],
];

export function settoriDaTitolo(titolo: string) {
  return filtro(TITOLI.flatMap(([re, spec]) => (re.test(titolo) ? div(spec) : [])));
}

const BANDINTELLIGENCE: Record<string, string> = {
  agricoltura: AGRICOLTURA, manifattura: "10-33", cultura: "58-60 90-91", turismo: TURISMO,
};

export function settoriBandIntelligence(settore: string | null, titolo: string) {
  const spec = settore && BANDINTELLIGENCE[settore];
  return spec ? filtro(div(spec)) : settoriDaTitolo(titolo);
}

/** Testo che parla di enti pubblici o privati cittadini e mai di imprese: non è un bando per i clienti. */
export function soloNonImprese(testo: string) {
  return /\b(?:ai|per|dei|e) comuni\b|enti locali|enti pubblici|progetti universitari|contributi individuali/i.test(testo)
    && !/impres|\bPMI\b|aziend|professionist|veicoli commerciali/i.test(testo);
}
