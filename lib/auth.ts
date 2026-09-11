const encoder = new TextEncoder();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET non configurato");
  return secret;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signature(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64Url(new Uint8Array(sig));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken() {
  const issuedAt = Date.now().toString();
  return `${issuedAt}.${await signature(issuedAt)}`;
}

export async function verifySessionToken(token: string) {
  try {
    const [issuedAt, sig] = token.split(".");
    if (!issuedAt || !sig) return false;

    const timestamp = Number(issuedAt);
    if (!Number.isFinite(timestamp)) return false;
    if (Date.now() - timestamp > SESSION_TTL_MS) return false;
    if (timestamp > Date.now() + 60_000) return false;

    return safeEqual(sig, await signature(issuedAt));
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE = Math.floor(SESSION_TTL_MS / 1000);
