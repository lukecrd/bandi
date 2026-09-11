import { neon } from "@neondatabase/serverless";

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL non configurato. Collega un database Neon al progetto Vercel."
    );
  }
  return neon(url);
}
