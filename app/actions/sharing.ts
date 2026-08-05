"use server";

import { sql } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Initializes public keys and shared items tables in NeonDB.
 */
export async function initSharingTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS vault_public_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        public_key_hex TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS vault_shared_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_username VARCHAR(255) NOT NULL,
        sender_username VARCHAR(255) NOT NULL,
        item_title VARCHAR(255) NOT NULL,
        encrypted_payload TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to init sharing tables:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Registers a user's Public Key for sharing.
 */
export async function registerPublicKey(username: string, publicKeyHex: string) {
  try {
    await initSharingTables();
    await sql`
      INSERT INTO vault_public_keys (username, public_key_hex)
      VALUES (${username}, ${publicKeyHex})
      ON CONFLICT (username) DO UPDATE SET public_key_hex = ${publicKeyHex}
    `;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetches a user's registered Public Key by username.
 */
export async function getPublicKey(username: string) {
  try {
    await initSharingTables();
    const rows = await sql`
      SELECT public_key_hex FROM vault_public_keys WHERE username = ${username} LIMIT 1
    `;
    if (rows.length > 0 && (rows[0] as any).public_key_hex) {
      return { success: true, publicKeyHex: (rows[0] as any).public_key_hex as string };
    }
    return { success: false, error: "User public key not found" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Saves an end-to-end encrypted shared item payload for a recipient.
 */
export async function shareItemWithUser(
  recipientUsername: string,
  senderUsername: string,
  itemTitle: string,
  encryptedPayload: string
) {
  try {
    await initSharingTables();
    await sql`
      INSERT INTO vault_shared_items (recipient_username, sender_username, item_title, encrypted_payload)
      VALUES (${recipientUsername}, ${senderUsername}, ${itemTitle}, ${encryptedPayload})
    `;
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetches shared items targeting a specific recipient username.
 */
export async function getSharedItemsForUser(recipientUsername: string) {
  try {
    await initSharingTables();
    const rows = await sql`
      SELECT id, recipient_username, sender_username, item_title, encrypted_payload, created_at
      FROM vault_shared_items
      WHERE recipient_username = ${recipientUsername}
      ORDER BY created_at DESC
    `;
    return { success: true, items: rows };
  } catch (error: any) {
    return { success: false, items: [], error: error.message };
  }
}
