// Helper to convert ArrayBuffer to hex string
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper to convert hex string to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// High-entropy fixed salt for deriving the Master Key from the Master Password
const MASTER_SALT = new TextEncoder().encode("personalvault_ultra_secure_pbkdf2_sha512_salt_v2_2026");

/**
 * Derives a 256-bit AES-GCM CryptoKey from the user's Master Password
 * using OWASP-grade PBKDF2 with SHA-512 and 600,000 iterations.
 */
export async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  // Import the password as a raw key
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // Derive 256-bit AES-GCM key with 600,000 iterations of HMAC-SHA512
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: MASTER_SALT,
      iterations: 600000,
      hash: "SHA-512",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, // Non-extractable (maximum browser security)
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts cleartext using AES-GCM (256-bit) with a fresh random 96-bit IV.
 * Returns formatted string: `iv_hex:ciphertext_hex`
 */
export async function encryptText(text: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const cleartextBytes = encoder.encode(text);

  // Generate a cryptographically secure 12-byte (96-bit) IV for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      tagLength: 128, // Maximum 128-bit authentication tag
    },
    key,
    cleartextBytes
  );

  const ivHex = bufToHex(iv.buffer);
  const ciphertextHex = bufToHex(ciphertextBuffer);

  return `${ivHex}:${ciphertextHex}`;
}

/**
 * Decrypts ciphertext (`iv_hex:ciphertext_hex`) using 256-bit AES-GCM.
 * Returns the cleartext string.
 */
export async function decryptText(encryptedData: string, key: CryptoKey): Promise<string> {
  const parts = encryptedData.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted data format");
  }

  const ivHex = parts[0];
  const ciphertextHex = parts[1];

  const iv = hexToBuf(ivHex);
  const ciphertext = hexToBuf(ciphertextHex);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      tagLength: 128, // 128-bit authentication tag check
    },
    key,
    ciphertext as BufferSource
  );

  return new TextDecoder().decode(decryptedBuffer);
}
