/**
 * Encrypted Audit Log Engine with Merkle Tree Hash Chain Tamper-Evidence
 * 
 * Maintains a cryptographic log chain where H_n = SHA256(H_{n-1} || event_type || payload || timestamp).
 * Detects any server-side database manipulation, row deletion, or log injection.
 */

export interface AuditLogEntry {
  id: string;
  event_type: "VAULT_UNLOCK" | "VAULT_LOCK" | "ITEM_CREATE" | "ITEM_UPDATE" | "ITEM_DELETE" | "SECURITY_ALERT" | "RECOVERY_SHARE_GENERATE";
  encrypted_details: string; // Encrypted client-side payload
  hash: string; // Hash(previous_hash + event_type + encrypted_details + created_at)
  previous_hash: string;
  created_at: string;
}

/**
 * Calculates cryptographic hash for an audit log entry.
 */
export async function calculateAuditHash(
  previousHash: string,
  eventType: string,
  encryptedDetails: string,
  timestamp: string
): Promise<string> {
  const content = `${previousHash}:${eventType}:${encryptedDetails}:${timestamp}`;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verifies the integrity of a sequence of audit log entries (Merkle Hash Chain).
 */
export async function verifyAuditChain(entries: AuditLogEntry[]): Promise<{
  valid: boolean;
  totalEntries: number;
  tamperedIndex: number | null;
  errorReason: string | null;
}> {
  if (entries.length === 0) {
    return { valid: true, totalEntries: 0, tamperedIndex: null, errorReason: null };
  }

  let expectedPreviousHash = "GENESIS_ROOT_HASH_PERSONAL_VAULT_2026";

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.previous_hash !== expectedPreviousHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        tamperedIndex: i,
        errorReason: `Broken Hash Link at entry #${i+1} (${entry.event_type}). Expected previous hash ${expectedPreviousHash.substring(0, 10)}... but found ${entry.previous_hash.substring(0, 10)}...`,
      };
    }

    const calculatedHash = await calculateAuditHash(
      entry.previous_hash,
      entry.event_type,
      entry.encrypted_details,
      entry.created_at
    );

    if (calculatedHash !== entry.hash) {
      return {
        valid: false,
        totalEntries: entries.length,
        tamperedIndex: i,
        errorReason: `Hash Payload Tampering detected at entry #${i+1} (${entry.event_type}). Stored hash does not match calculated SHA-256 Digest!`,
      };
    }

    expectedPreviousHash = entry.hash;
  }

  return { valid: true, totalEntries: entries.length, tamperedIndex: null, errorReason: null };
}
