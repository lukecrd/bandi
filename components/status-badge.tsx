export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLocaleLowerCase("it-IT");
  const cls =
    normalized === "aperto" ? "open" :
    normalized === "in arrivo" ? "forthcoming" :
    normalized === "success" ? "success" :
    normalized === "running" ? "running" :
    normalized === "error" ? "error" : "";

  return <span className={`badge ${cls}`}>{value}</span>;
}
