/** Cifre significative: "01.00" e "01" sono la stessa divisione, "55.10" e "55.1" lo stesso gruppo. */
function cifre(codice: string) {
  const tutte = codice.replace(/\D/g, "");
  return tutte.slice(0, 2) + tutte.slice(2).replace(/0+$/, "");
}

/**
 * Codici del cliente fino alla classe (4 cifre). Il campo è libero: regge più codici separati da "/" o ",",
 * incollati tra loro ("52.10.152.21.6") o scritti senza punti ("432409").
 */
export function codiciCliente(testo: string | null | undefined) {
  const trovati = (testo ?? "").match(/\d{2}\.\d{1,2}|(?<![\d.])\d{2,6}(?![\d.])/g) ?? [];
  return [...new Set(trovati.map((c) => cifre(c.replace(".", "").slice(0, 4))))];
}

/** Codici ammessi dal bando; ["*"] = tutti i settori, o elenco non leggibile: nel dubbio il bando resta visibile. */
export function codiciBando(testo: string | null) {
  const voci = (testo ?? "").replace(/ATECO\s*\d{4}\s*:/gi, "").split(/[;,]/).map((v) => v.trim()).filter(Boolean);
  if (!voci.length || !voci.every((v) => /^\d{2}(\.\d{1,2}){0,3}$/.test(v))) return ["*"];
  return [...new Set(voci.map((v) => cifre(v).replace(/^(\d{2})(?=\d)/, "$1.")))];
}

/**
 * null = non si può dire: il bando non elenca codici o il cliente non ne ha di leggibili.
 * shortcut: ATECO 2007 e 2025 si confrontano senza conversione; serve la tabella ISTAT se i clienti non aggiornano i codici.
 */
export function atecoAmmesso(codici: string[], filtro: string[]) {
  if (!filtro.length || filtro.includes("*") || !codici.length) return null;
  const ammessi = filtro.map(cifre);
  // nei due sensi: un cliente "47" può rientrare in un bando per il 47.91
  return codici.some((c) => ammessi.some((a) => c.startsWith(a) || a.startsWith(c)));
}
