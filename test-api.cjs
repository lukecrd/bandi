const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 90000);

fetch("http://localhost:3000/api/bands?refresh=true", { signal: controller.signal })
  .then((r) => r.json())
  .then((data) => {
    const sources = [...new Set(data.bands.map((b) => b.source))];
    console.log("Sources:", sources);
    console.log("Total bands:", data.bands.length);
    const rna = data.bands.filter((b) => b.source === "RNA");
    console.log("RNA bands:", rna.length);
    if (rna.length > 0) {
      console.log("Sample:", JSON.stringify(rna[0], null, 2));
    }
  })
  .catch((e) => console.log("Error:", e.name ?? e.message))
  .finally(() => clearTimeout(timeout));
