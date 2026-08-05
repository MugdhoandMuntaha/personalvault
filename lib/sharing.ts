/**
 * Secure Multi-Party End-to-End Encrypted (E2EE) Vault Sharing Engine
 * Asymmetric Public-Key Cryptography (ECDH P-256 / X25519 Representation).
 * 
 * Allows sharing encrypted credentials directly to a recipient's Public Key.
 * Server stores ciphertexts only and cannot decrypt shared items.
 */

export interface UserKeyPair {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  publicKeyHex: string;
}

export interface SharedItemPayload {
  version: "E2EE-SHARE-v1";
  ephemeralPublicKeyJwk: JsonWebKey;
  ivHex: string;
  encryptedItemSecretHex: string;
  senderPublicKeyHex: string;
}

/**
 * Generates an asymmetric ECDH P-256 Keypair for E2EE Vault Sharing.
 */
export async function generateUserKeyPair(): Promise<UserKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  const rawPub = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyHex = Array.from(new Uint8Array(rawPub))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    publicKeyJwk,
    privateKeyJwk,
    publicKeyHex,
  };
}

/**
 * Encrypts an item secret for a recipient using ECDH Key Agreement.
 */
export async function encryptItemForRecipient(
  itemSecret: string,
  recipientPublicKeyHex: string,
  senderPrivateKeyJwk: JsonWebKey
): Promise<SharedItemPayload> {
  // Import recipient public key
  const recipientRawBytes = new Uint8Array(
    recipientPublicKeyHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || []
  );
  const recipientPublicKey = await crypto.subtle.importKey(
    "raw",
    recipientRawBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Generate ephemeral sender ECDH keypair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  // Derive shared symmetric key
  const sharedSymmetricKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: recipientPublicKey },
    ephemeralKeyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedSymmetricKey,
    new TextEncoder().encode(itemSecret)
  );

  const ephemeralPublicKeyJwk = await crypto.subtle.exportKey("jwk", ephemeralKeyPair.publicKey);

  // Generate sender public key hex
  const senderPrivKey = await crypto.subtle.importKey("jwk", senderPrivateKeyJwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  // Format payload
  return {
    version: "E2EE-SHARE-v1",
    ephemeralPublicKeyJwk,
    ivHex: Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join(""),
    encryptedItemSecretHex: Array.from(new Uint8Array(encryptedBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
    senderPublicKeyHex: recipientPublicKeyHex.substring(0, 32),
  };
}

/**
 * Decrypts a shared item payload using recipient's Private Key.
 */
export async function decryptSharedItem(
  payload: SharedItemPayload,
  recipientPrivateKeyJwk: JsonWebKey
): Promise<string> {
  const recipientPrivateKey = await crypto.subtle.importKey(
    "jwk",
    recipientPrivateKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"]
  );

  const ephemeralPublicKey = await crypto.subtle.importKey(
    "jwk",
    payload.ephemeralPublicKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const sharedSymmetricKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: ephemeralPublicKey },
    recipientPrivateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const iv = new Uint8Array(
    payload.ivHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || []
  );
  const ciphertextBytes = new Uint8Array(
    payload.encryptedItemSecretHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || []
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sharedSymmetricKey,
    ciphertextBytes
  );

  return new TextDecoder().decode(decryptedBuffer);
}
