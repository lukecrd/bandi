import { LoginForm } from "@/components/login-form";
import { LoginScene } from "@/components/login-scene";
import { getOpenGrantsByRegion } from "@/lib/data";
import { ITALY_REGIONS } from "@/lib/italy-points";

export const dynamic = "force-dynamic";

// Nel DB convivono varianti come "Valle d'Aosta/Vallée d'Aoste" e "Friuli Venezia Giulia".
const key = (name: string) => name.split("/")[0].toLowerCase().replace(/-/g, " ").trim();

async function regionCounts() {
  try {
    const { byRegion, total } = await getOpenGrantsByRegion();
    const names = new Map(ITALY_REGIONS.map((r) => [key(r.name), r.name]));
    const counts: Record<string, number> = {};
    for (const { region, n } of byRegion) {
      const name = names.get(key(region));
      if (name) counts[name] = (counts[name] ?? 0) + n;
    }
    return { counts, total };
  } catch {
    // Il login deve funzionare anche se il DB non risponde: la mappa resta senza numeri.
    return { counts: {}, total: 0 };
  }
}

export default async function LoginPage() {
  const { counts, total } = await regionCounts();
  return (
    <LoginScene counts={counts} total={total}>
      <p className="muted">Accedi alla piattaforma di matching clienti ↔ bandi.</p>
      <LoginForm />
    </LoginScene>
  );
}
