async function main() {
  try {
    const res = await fetch("https://www.rna.gov.it/sites/rna.mise.gov.it/files/opendata/OpenData_Aiuti_2026_08.xml");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let xmlText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      xmlText += decoder.decode(value, { stream: true });
      if (xmlText.includes("</AIUO>") && (xmlText.match(/<AIUO[ >]/g) || []).length >= 1) break;
    }
    xmlText += decoder.decode();

    // Find TITOLO_MISURA and print surrounding context
    const titleIdx = xmlText.indexOf("TITOLO_MISURA");
    if (titleIdx > 0) {
      console.log("=== Context around TITOLO_MISURA ===");
      console.log(xmlText.substring(titleIdx - 50, titleIdx + 500));
    }

    // Find all tag names in the first AIULO block
    const aiuloMatch = xmlText.match(/<AIUO[\s\S]*?<\/AIUO>/);
    if (aiuloMatch) {
      const tags = [...aiuloMatch[0].matchAll(/<([A-Z][A-Z0-9_]*)>/g)].map((m) => m[1]);
      console.log("\n=== All tags in first AIUO block ===");
      console.log([...new Set(tags)].join(", "));
    }

    // Search for REGIONE tag
    const regionIdx = xmlText.indexOf("REGIONE");
    if (regionIdx > 0) {
      console.log("\n=== Context around REGIONE ===");
      console.log(xmlText.substring(regionIdx - 50, regionIdx + 200));
    }

    // Search for CODICE_ATECO
    const atecoIdx = xmlText.indexOf("CODICE_ATECO");
    if (atecoIdx > 0) {
      console.log("\n=== Context around CODICE_ATECO ===");
      console.log(xmlText.substring(atecoIdx - 50, atecoIdx + 200));
    }

    // Search for IMPORTO
    const impIdx = xmlText.indexOf("IMPORTO");
    if (impIdx > 0) {
      console.log("\n=== Context around IMPORTO ===");
      console.log(xmlText.substring(impIdx - 50, impIdx + 200));
    }

    // Search for date fields
    const datePatterns = ["DATA", "SCADENZA", "TERMINE", "ANNO", "DATAZIONE"];
    for (const pattern of datePatterns) {
      const idx = xmlText.indexOf(pattern);
      if (idx > 0) {
        console.log(`\n=== Context around ${pattern} ===`);
        console.log(xmlText.substring(idx - 30, idx + 150));
        break;
      }
    }

    // Search for REGIONE or region
    const regPatterns = ["REGIONE", "Regione", "regione", "CODICE_REGIONE", "DES_REGIONE"];
    for (const pattern of regPatterns) {
      const idx = xmlText.indexOf(pattern);
      if (idx > 0) {
        console.log(`\n=== Context around ${pattern} ===`);
        console.log(xmlText.substring(idx - 30, idx + 200));
        break;
      }
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}

main();
