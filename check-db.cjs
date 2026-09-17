const Database = require("better-sqlite3");
const db = new Database("bandi.db");
const rna = db.prepare("SELECT * FROM bands WHERE source = 'RNA'").all();
console.log("RNA bands:", rna.length);
for (const b of rna) {
  console.log("\n---");
  console.log("Titolo:", b.titolo);
  console.log("Ente:", b.ente);
  console.log("Regione:", b.regione);
  console.log("Settore:", b.settore);
  console.log("Importo:", b.importo);
  console.log("Scadenza:", b.scadenza);
  console.log("Link:", b.link);
}
db.close();
