import { DocumentType, ModuloType, CampoTemplate } from "@/lib/types";

export interface DocumentFieldMapping {
  documentType: DocumentType;
  fields: { campo: string; valoreDa: string; label: string }[];
}

export const documentFieldMappings: DocumentFieldMapping[] = [
  {
    documentType: "iban",
    fields: [
      { campo: "contabile_iban", valoreDa: "iban", label: "IBAN Conto" },
      { campo: "contabile_intestatario", valoreDa: "intestatario", label: "Intestatario Conto" },
    ],
  },
  {
    documentType: "iscrizione_inps",
    fields: [
      { campo: "inps_numero", valoreDa: "numero_iscrizione", label: "Numero Iscrizione INPS" },
      { campo: "inps_data", valoreDa: "data_iscrizione", label: "Data Iscrizione INPS" },
    ],
  },
  {
    documentType: "polizza_catastrofale",
    fields: [
      { campo: "assicurazione_numero", valoreDa: "numero_polizza", label: "Numero Polizza" },
      { campo: "assicurazione_scadenza", valoreDa: "scadenza_polizza", label: "Scadenza Polizza" },
      { campo: "assicurazione_compagnia", valoreDa: "compagnia", label: "Compagnia Assicurativa" },
    ],
  },
  {
    documentType: "visura",
    fields: [
      { campo: "azienda_partita_iva", valoreDa: "partita_iva", label: "Partita IVA" },
      { campo: "azienda_registro", valoreDa: "registro", label: "Registro Imprese" },
      { campo: "azienda_rea", valoreDa: "rea", label: "REA" },
      { campo: "azienda_forma_giuridica", valoreDa: "forma_giuridica", label: "Forma Giuridica" },
    ],
  },
  {
    documentType: "fatture",
    fields: [
      { campo: "fatturati_anno", valoreDa: "anno", label: "Anno Fatturato" },
      { campo: "fatturati_totale", valoreDa: "totale", label: "Totale Fatturato" },
      { campo: "fatture_ultimo_esercizio", valoreDa: "ultimo_esercizio", label: "Ultimo Esercizio" },
    ],
  },
  {
    documentType: "quietanza",
    fields: [
      { campo: "pagamento_data", valoreDa: "data", label: "Data Pagamento" },
      { campo: "pagamento_importo", valoreDa: "importo", label: "Importo Pagamento" },
      { campo: "pagamento_bollo", valoreDa: "bollo", label: "Bollo" },
    ],
  },
];

const _domandaBando: CampoTemplate[] = [
  { nome: "richiedente", etichetta: "Richiedente", tipo: "testo", obbligatorio: true },
  { nome: "partita_iva", etichetta: "Partita IVA", tipo: "testo", obbligatorio: true },
  { nome: "contabile_iban", etichetta: "IBAN Conto", tipo: "testo", obbligatorio: true, documento_fonte: ["iban"] },
  { nome: "contabile_intestatario", etichetta: "Intestatario Conto", tipo: "testo", obbligatorio: true, documento_fonte: ["iban"] },
  { nome: "azienda_partita_iva", etichetta: "Partita IVA Azienda", tipo: "testo", obbligatorio: true, documento_fonte: ["visura"] },
  { nome: "azienda_registro", etichetta: "Registro Imprese", tipo: "testo", obbligatorio: false, documento_fonte: ["visura"] },
  { nome: "azienda_rea", etichetta: "REA", tipo: "testo", obbligatorio: false, documento_fonte: ["visura"] },
  { nome: "fatturati_anno", etichetta: "Fatturato Anno", tipo: "numero", obbligatorio: true, documento_fonte: ["fatture"] },
  { nome: "fatture_ultimo_esercizio", etichetta: "Ultimo Esercizio", tipo: "data", obbligatorio: false, documento_fonte: ["fatture"] },
  { nome: "pagamento_data", etichetta: "Data Ultimo Pagamento", tipo: "data", obbligatorio: false, documento_fonte: ["quietanza"] },
  { nome: "pagamento_importo", etichetta: "Importo Ultimo Pagamento", tipo: "numero", obbligatorio: false, documento_fonte: ["quietanza"] },
];

const _delegaBando: CampoTemplate[] = [
  { nome: "delegante", etichetta: "Delegante", tipo: "testo", obbligatorio: true },
  { nome: "delegato", etichetta: "Delegato", tipo: "testo", obbligatorio: true },
  { nome: "contabile_iban", etichetta: "IBAN Conto", tipo: "testo", obbligatorio: true, documento_fonte: ["iban"] },
  { nome: "contabile_intestatario", etichetta: "Intestatario Conto", tipo: "testo", obbligatorio: true, documento_fonte: ["iban"] },
  { nome: "azienda_partita_iva", etichetta: "Partita IVA Azienda", tipo: "testo", obbligatorio: true, documento_fonte: ["visura"] },
  { nome: "azienda_forma_giuridica", etichetta: "Forma Giuridica", tipo: "testo", obbligatorio: false, documento_fonte: ["visura"] },
];

const _allegatoA: CampoTemplate[] = [
  { nome: "assicurazione_numero", etichetta: "Numero Polizza", tipo: "testo", obbligatorio: true, documento_fonte: ["polizza_catastrofale"] },
  { nome: "assicurazione_scadenza", etichetta: "Scadenza Polizza", tipo: "data", obbligatorio: true, documento_fonte: ["polizza_catastrofale"] },
  { nome: "assicurazione_compagnia", etichetta: "Compagnia Assicurativa", tipo: "testo", obbligatorio: true, documento_fonte: ["polizza_catastrofale"] },
  { nome: "fatturati_totale", etichetta: "Totale Fatturato", tipo: "numero", obbligatorio: true, documento_fonte: ["fatture"] },
  { nome: "pagamento_bollo", etichetta: "Bollo", tipo: "testo", obbligatorio: false, documento_fonte: ["quietanza"] },
];

const _dichiarazioneInps: CampoTemplate[] = [
  { nome: "inps_numero", etichetta: "Numero Iscrizione INPS", tipo: "testo", obbligatorio: true, documento_fonte: ["iscrizione_inps"] },
  { nome: "inps_data", etichetta: "Data Iscrizione INPS", tipo: "data", obbligatorio: true, documento_fonte: ["iscrizione_inps"] },
  { nome: "pagamento_data", etichetta: "Data Pagamento", tipo: "data", obbligatorio: false, documento_fonte: ["quietanza"] },
  { nome: "pagamento_importo", etichetta: "Importo Pagamento", tipo: "numero", obbligatorio: false, documento_fonte: ["quietanza"] },
  { nome: "azienda_partita_iva", etichetta: "Partita IVA", tipo: "testo", obbligatorio: true, documento_fonte: ["visura"] },
];

export const moduloTemplates: Record<ModuloType, CampoTemplate[]> = {
  domanda_bando: _domandaBando,
  delega_bando: _delegaBando,
  allegato_a: _allegatoA,
  dichiarazione_inps: _dichiarazioneInps,
};

export function getModuloTemplate(tipo: ModuloType): CampoTemplate[] | undefined {
  return moduloTemplates[tipo];
}

export function getApplicableDocuments(tipo: ModuloType, documenti: { tipo: DocumentType }[]): DocumentType[] {
  const template = getModuloTemplate(tipo);
  if (!template) return [];
  const needed: DocumentType[] = [];
  for (const campo of template) {
    if (campo.documento_fonte) {
      for (const docType of campo.documento_fonte) {
        if (!needed.includes(docType) && documenti.some((d) => d.tipo === docType)) {
          needed.push(docType);
        }
      }
    }
  }
  return needed;
}
