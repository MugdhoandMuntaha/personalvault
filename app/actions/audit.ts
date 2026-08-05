"use server";

import { sql } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface AuditLogRecord {
  id: string;
  event_type: string;
  encrypted_details: string;
  hash: string;
  previous_hash: string;
  created_at: string;
}

/**
 * Initializes audit log table in NeonDB if it doesn't exist.
 */
export async function initAuditLogTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS vault_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(100) NOT NULL,
        encrypted_details TEXT NOT NULL,
        hash VARCHAR(64) NOT NULL,
        previous_hash VARCHAR(64) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to init audit log table:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches the latest audit log entry hash to maintain Merkle chain continuity.
 */
export async function getLatestAuditHash(): Promise<string> {
  try {
    await initAuditLogTable();
    const rows = await sql`
      SELECT hash FROM vault_audit_logs ORDER BY created_at DESC LIMIT 1
    `;
    if (rows.length > 0 && (rows[0] as any).hash) {
      return (rows[0] as any).hash;
    }
    return "GENESIS_ROOT_HASH_PERSONAL_VAULT_2026";
  } catch (error) {
    return "GENESIS_ROOT_HASH_PERSONAL_VAULT_2026";
  }
}

/**
 * Appends a new tamper-evident audit log entry to NeonDB.
 */
export async function addAuditLogEntry(
  eventType: string,
  encryptedDetails: string,
  hash: string,
  previousHash: string
) {
  try {
    await initAuditLogTable();
    await sql`
      INSERT INTO vault_audit_logs (event_type, encrypted_details, hash, previous_hash)
      VALUES (${eventType}, ${encryptedDetails}, ${hash}, ${previousHash})
    `;
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to add audit log entry:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Retrieves all audit log entries in chronological order for client Merkle tree verification.
 */
export async function getAuditLogs(): Promise<{ success: boolean; logs: AuditLogRecord[]; error?: string }> {
  try {
    await initAuditLogTable();
    const rows = await sql`
      SELECT id, event_type, encrypted_details, hash, previous_hash, created_at
      FROM vault_audit_logs
      ORDER BY created_at ASC
    `;
    return { success: true, logs: rows as unknown as AuditLogRecord[] };
  } catch (error: any) {
    console.error("Failed to fetch audit logs:", error);
    return { success: false, logs: [], error: error.message };
  }
}
