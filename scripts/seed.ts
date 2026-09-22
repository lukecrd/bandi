import db from "@/lib/db";

async function seed() {
  const existingClients = db.prepare("SELECT COUNT(*) as count FROM clients").get() as { count: number };
  if (existingClients.count > 0) {
    console.log("Database already seeded");
    return;
  }

  const clients = [
    { id: crypto.randomUUID(), ragione_sociale: "TechNova S.r.l.", partita_iva: "IT12345678901", settore: "Technologie", regione: "Lombardia", taglia_aziendale: "Media", requisiti: "certificazione ISO 27001 esperienza ERP", note: "Cliente storico" },
    { id: crypto.randomUUID(), ragione_sociale: "AgriFuture di Rossi", partita_iva: "IT09876543210", settore: "Agricoltura", regione: "Lazio", taglia_aziendale: "Piccola", requisiti: "partita IVA agricola 5 anni esperienza", note: "" },
    { id: crypto.randomUUID(), ragione_sociale: "EdilCostruzioni S.p.A.", partita_iva: "IT11223344556", settore: "Edilizia", regione: "Veneto", taglia_aziendale: "Grande", requisiti: "requisiti SOF rated A esperienza 10 anni", note: "" },
    { id: crypto.randomUUID(), ragione_sociale: "GreenEnergy di Bianchi", partita_iva: "IT55667788990", settore: "Energia", regione: "Emilia-Romagna", taglia_aziendale: "Media", requisiti: "certificazione energetica esperienza impianti", note: "Start-up recente" },
    { id: crypto.randomUUID(), ragione_sociale: "CommercePro S.r.l.", partita_iva: "IT33445566778", settore: "Commercio", regione: "Toscana", taglia_aziendale: "Piccola", requisiti: "esperienza export certificazione qualità", note: "" },
    { id: crypto.randomUUID(), ragione_sociale: "InnoTech di Verdi", partita_iva: "IT99887766554", settore: "Innovazione", regione: "Campania", taglia_aziendale: "Micro", requisiti: "brevetto tecnologico startup innovativa", note: "" },
    { id: crypto.randomUUID(), ragione_sociale: "CostruzioniNord s.r.l.", partita_iva: "IT44556677889", settore: "Edilizia", regione: "Lombardia", taglia_aziendale: "Media", requisiti: "SOF categoria OS2 esperienza 5 anni", note: "" },
    { id: crypto.randomUUID(), ragione_sociale: "AgriTech Sud", partita_iva: "IT66778899001", settore: "Agricoltura", regione: "Puglia", taglia_aziendale: "Media", requisiti: "precision farming IoT esperienza", note: "" },
  ];

  for (const c of clients) {
    db.prepare(`
      INSERT INTO clients (id, ragione_sociale, partita_iva, settore, regione, taglia_aziendale, requisiti, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(c.id, c.ragione_sociale, c.partita_iva, c.settore, c.regione, c.taglia_aziendale, c.requisiti, c.note);
  }

  const bands = [
    { id: crypto.randomUUID(), titolo: "Progetto di trasformazione digitale per PMI", ente: "Ministero delle Imprese e del Made in Italy", regione: "Lombardia", settore: "Technologie", importo: "2.000.000 EUR", scadenza: "2026-12-31", requisiti: "Partita IVA attiva, fatturato annuo < 5M EUR, sede legale in Italia, certificazione ISO 9001", descrizione: "Finanziamento per la digitalizzazione delle piccole e medie imprese.", link: "https://example.com/bando/1", source: "Simulato" },
    { id: crypto.randomUUID(), titolo: "Bando per l'Innovazione nel Settore Agroalimentare", ente: "Regione Lazio", regione: "Lazio", settore: "Agricoltura", importo: "1.500.000 EUR", scadenza: "2026-11-30", requisiti: "Impresa agricola iscritta alla Camera di Commercio, presenza in regione Lazio, esperienza pregressa", descrizione: "Supporto all'innovazione tecnologica nel settore agroalimentare.", link: "https://example.com/bando/2", source: "Simulato" },
    { id: crypto.randomUUID(), titolo: "Programma di Sostegno alle Start-up Innovative", ente: "Invitalia", regione: "Campania", settore: "Innovazione", importo: "500.000 EUR", scadenza: "2026-10-15", requisiti: "Start-up costituita da meno di 5 anni, brevetto o know-how innovativo, business plan approvato", descrizione: "Borse di investimento per start-up innovative.", link: "https://example.com/bando/3", source: "Simulato" },
    { id: crypto.randomUUID(), titolo: "Appalto per Servizi di Manutenzione Infrastrutture Scolastiche", ente: "Comune di Milano", regione: "Lombardia", settore: "Edilizia", importo: "3.500.000 EUR", scadenza: "2026-08-20", requisiti: "Requisiti SOF, esperienza pregressa 5 anni nel settore, idoneità morale e professionale", descrizione: "Servizi di manutenzione straordinaria e ordinaria delle infrastrutture scolastiche.", link: "https://example.com/bando/4", source: "Simulato" },
    { id: crypto.randomUUID(), titolo: "Bando per l'Efficienza Energetica degli Edifici Pubblici", ente: "ENRAL", regione: "Veneto", settore: "Energia", importo: "4.000.000 EUR", scadenza: "2026-09-30", requisiti: "Ente pubblico o privativo con finalità pubblica, certificazione energetica inferiore a F, esperienza impianti", descrizione: "Interventi di riqualificazione energetica di edifici pubblici.", link: "https://example.com/bando/5", source: "Simulato" },
    { id: crypto.randomUUID(), titolo: "Contributi per Internazionalizzazione delle PMI", ente: "ICE Agenzia", regione: "Emilia-Romagna", settore: "Commercio", importo: "800.000 EUR", scadenza: "2026-11-15", requisiti: "Fatturato estero < 50% del totale, esperienza internazionale certificazione qualità ISO", descrizione: "Sostegno alle PMI per l'apertura di nuovi mercati esteri.", link: "https://example.com/bando/6", source: "Simulato" },
    { id: crypto.randomUUID(), titolo: "Finanziamento per Transizione Ecologica Industriale", ente: "MiTE", regione: "Toscana", settore: "Energia", importo: "6.000.000 EUR", scadenza: "2026-10-01", requisiti: "Impresa industriale con emissioni CO2 significative, piano di decarbonizzazione certificazione ambientale", descrizione: "Interventi di transizione ecologica per le imprese industriali.", link: "https://example.com/bando/7", source: "Simulato" },
    { id: crypto.randomUUID(), titolo: "Bando per la Digitalizzazione del Settore Pubblico", ente: "AgID", regione: "Puglia", settore: "Technologie", importo: "1.200.000 EUR", scadenza: "2026-12-15", requisiti: "Ente pubblico, piano trasformazione digitale, esperienza cloud computing certificazione", descrizione: "Progetti di digitalizzazione per enti del settore pubblico.", link: "https://example.com/bando/8", source: "Simulato" },
  ];

  for (const b of bands) {
    db.prepare(`
      INSERT INTO bands (id, titolo, ente, regione, settore, importo, scadenza, requisiti, descrizione, link, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(b.id, b.titolo, b.ente, b.regione, b.settore, b.importo, b.scadenza, b.requisiti, b.descrizione, b.link, b.source);
  }

  console.log("Seeded:", clients.length, "clients and", bands.length, "bands");
}

seed().catch(console.error);
