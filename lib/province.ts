const PROVINCE: Record<string, string> = {
  Abruzzo: "AQ L'Aquila,CH Chieti,PE Pescara,TE Teramo",
  Basilicata: "MT Matera,PZ Potenza",
  Calabria: "CS Cosenza,CZ Catanzaro,KR Crotone,RC Reggio Calabria,VV Vibo Valentia",
  Campania: "AV Avellino,BN Benevento,CE Caserta,NA Napoli,SA Salerno",
  "Emilia-Romagna": "BO Bologna,FE Ferrara,FC Forli Cesena,MO Modena,PR Parma,PC Piacenza,RA Ravenna,RE Reggio Emilia,RN Rimini",
  "Friuli-Venezia Giulia": "GO Gorizia,PN Pordenone,TS Trieste,UD Udine",
  Lazio: "FR Frosinone,LT Latina,RI Rieti,RM Roma,VT Viterbo",
  Liguria: "GE Genova,IM Imperia,SP La Spezia,SV Savona",
  Lombardia: "BG Bergamo,BS Brescia,CO Como,CR Cremona,LC Lecco,LO Lodi,MN Mantova,MI Milano,MB Monza,PV Pavia,SO Sondrio,VA Varese",
  Marche: "AN Ancona,AP Ascoli Piceno,FM Fermo,MC Macerata,PU Pesaro",
  Molise: "CB Campobasso,IS Isernia",
  Piemonte: "AL Alessandria,AT Asti,BI Biella,CN Cuneo,NO Novara,TO Torino,VB Verbano,VC Vercelli",
  Puglia: "BA Bari,BT Barletta,BR Brindisi,FG Foggia,LE Lecce,TA Taranto",
  Sardegna: "CA Cagliari,NU Nuoro,OR Oristano,SS Sassari,SU Sud Sardegna",
  Sicilia: "AG Agrigento,CL Caltanissetta,CT Catania,EN Enna,ME Messina,PA Palermo,RG Ragusa,SR Siracusa,TP Trapani",
  Toscana: "AR Arezzo,FI Firenze,GR Grosseto,LI Livorno,LU Lucca,MS Massa Carrara,PI Pisa,PT Pistoia,PO Prato,SI Siena",
  "Trentino-Alto Adige": "BZ Bolzano,TN Trento",
  Umbria: "PG Perugia,TR Terni",
  "Valle d'Aosta": "AO Aosta",
  Veneto: "BL Belluno,PD Padova,RO Rovigo,TV Treviso,VE Venezia,VI Vicenza,VR Verona",
};

// Camere il cui nome non contiene le province.
const CAMERE: [string, string][] = [
  ["toscana nord ovest", "LU MS PI"],
  ["maremma e tirreno", "GR LI"],
  ["della romagna", "FC RN"],
  ["gran sasso", "AQ TE"],
  ["irpinia sannio", "AV BN"],
  ["venezia giulia", "GO TS"],
  ["dell emilia", "PR PC RE"],
];

const piatto = (s: string) =>
  s.toLocaleLowerCase("it-IT").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z]+/g, " ").trim();

const ELENCO = Object.entries(PROVINCE).flatMap(([regione, voci]) =>
  voci.split(",").map((v) => ({ sigla: v.slice(0, 2), nome: piatto(v.slice(3)), regione }))
);

// Il matching chiede le stesse poche migliaia di testi per ogni coppia cliente-bando.
function memo<T>(calcola: (testo: string) => T) {
  const viste = new Map<string, T>();
  return (testo: string | null | undefined) => {
    const chiave = testo ?? "";
    if (!viste.has(chiave)) viste.set(chiave, calcola(chiave));
    return viste.get(chiave) as T;
  };
}

/** Accetta nome o sigla, come arrivano da Teamleader e dai moduli. */
export const provincia = memo((testo) => {
  const t = piatto(testo);
  return ELENCO.find((p) => t && (t === p.nome || t === p.sigla.toLowerCase() || t.startsWith(`${p.nome} `)));
});

/** Sigle delle province di una Camera di Commercio nominata nel testo; vuoto se non è un bando camerale o non si capisce. */
export const provinceCamera = memo((testo): string[] => {
  const t = ` ${piatto(testo)} `;
  if (!/ (?:camera di commercio|cciaa) /.test(t)) return [];
  const nominate = ELENCO.filter((p) => t.includes(` ${p.nome} `)).map((p) => p.sigla);
  return [...nominate, ...CAMERE.filter(([nome]) => t.includes(` ${nome} `)).flatMap(([, sigle]) => sigle.split(" "))];
});
