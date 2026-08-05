/**
 * Searchable Symmetric Encryption (SSE) & Blind Indexing Engine
 * Curtmola et al. inspired deterministic blind indexing.
 * 
 * Allows searching database records over encrypted search tokens
 * without server-side plaintext title exposure or bulk client decryption.
 */

/**
 * Derives a dedicated Search Key from the Master Password.
 */
export async function deriveSearchKey(masterPassword: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("PERSONAL_VAULT_SSE_SEARCH_INDEX_SALT_2026"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"]
  );
}

/**
 * Generates a blind search token for a single keyword.
 */
export async function generateBlindToken(word: string, searchKey: CryptoKey): Promise<string> {
  const normalized = word.trim().toLowerCase();
  if (!normalized) return "";

  const sig = await crypto.subtle.sign(
    "HMAC",
    searchKey,
    new TextEncoder().encode(normalized)
  );

  const hashArray = Array.from(new Uint8Array(sig));
  // Return first 16 hex chars (64-bit truncated blind index for minimal leakage & fast lookup)
  return hashArray
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Extracts keywords from text and generates a concatenated space-separated string of blind tokens.
 */
export async function generateBlindIndexString(text: string, searchKey: CryptoKey): Promise<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const tokens = await Promise.all(
    Array.from(new Set(words)).map((w) => generateBlindToken(w, searchKey))
  );

  return tokens.filter(Boolean).join(" ");
}
