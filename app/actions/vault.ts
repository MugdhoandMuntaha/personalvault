"use server";

import { sql } from "@/lib/db";
import { s3, BUCKET_NAME } from "@/lib/s3";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(path: string = "/") {
  try {
    revalidatePath(path);
  } catch (e) {
    // Ignore static generation store missing error
  }
}

export interface VaultItem {
  id: string;
  title: string;
  type: "password" | "note" | "card" | "credential" | "document" | "folder";
  username: string | null;
  secret: string | null; // Encrypted client-side (ivHex:ciphertextHex), null for documents/folders
  url: string | null;
  notes: string | null;
  
  // Document specific
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  storage_key: string | null;

  // Hierarchy & Status
  parent_id: string | null;
  is_favorite?: boolean;
  status?: "active" | "archived" | "trash";

  created_at: string;
  updated_at: string;
}

/**
 * Initializes the database tables if they do not exist (fallback helper).
 */
export async function initDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS vault_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        username VARCHAR(255),
        secret TEXT,
        url VARCHAR(500),
        notes TEXT,
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        file_size INTEGER,
        storage_key VARCHAR(500),
        blind_index_tokens TEXT,
        is_favorite BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'active',
        parent_id UUID REFERENCES vault_items(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`
      ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS blind_index_tokens TEXT;
    `;
    await sql`
      ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;
    `;
    await sql`
      ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
    `;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to initialize database:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches vault items inside a specific parent folder.
 */
export async function getVaultItems(parentId: string | null = null) {
  try {
    let items;
    if (parentId === null) {
      items = await sql`
        SELECT id, title, type, username, secret, url, notes, file_name, file_type, file_size, storage_key, parent_id, is_favorite, COALESCE(status, 'active') as status, created_at, updated_at
        FROM vault_items
        WHERE parent_id IS NULL AND type != 'vault_verification' AND (status = 'active' OR status IS NULL)
        ORDER BY type = 'folder' DESC, created_at DESC
      `;
    } else {
      items = await sql`
        SELECT id, title, type, username, secret, url, notes, file_name, file_type, file_size, storage_key, parent_id, is_favorite, COALESCE(status, 'active') as status, created_at, updated_at
        FROM vault_items
        WHERE parent_id = ${parentId} AND type != 'vault_verification' AND (status = 'active' OR status IS NULL)
        ORDER BY type = 'folder' DESC, created_at DESC
      `;
    }
    return { success: true, data: items as unknown as VaultItem[] };
  } catch (error: any) {
    console.error("Failed to fetch vault items:", error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Fetches all folders in the database to build folder lists or trees.
 */
export async function getAllFolders() {
  try {
    const folders = await sql`
      SELECT id, title, parent_id
      FROM vault_items
      WHERE type = 'folder'
      ORDER BY title ASC
    `;
    return { success: true, data: folders as unknown as { id: string; title: string; parent_id: string | null }[] };
  } catch (error: any) {
    console.error("Failed to fetch folders:", error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Resolves the breadcrumbs path from a specific folder up to root.
 */
export async function getFolderBreadcrumbs(folderId: string | null) {
  try {
    const crumbs: { id: string; title: string }[] = [];
    let currentId = folderId;

    while (currentId !== null) {
      const items = await sql`
        SELECT id, title, parent_id 
        FROM vault_items 
        WHERE id = ${currentId} AND type = 'folder'
      `;
      if (items.length === 0) break;
      const folder = items[0] as any;
      crumbs.unshift({ id: folder.id, title: folder.title });
      currentId = folder.parent_id;
    }

    return { success: true, data: crumbs };
  } catch (error: any) {
    console.error("Failed to fetch folder breadcrumbs:", error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Adds a new folder.
 */
export async function addFolder(title: string, parentId: string | null) {
  try {
    const folderTitle = title.trim();
    if (!folderTitle) {
      return { success: false, error: "Folder name is required." };
    }

    await sql`
      INSERT INTO vault_items (title, type, parent_id)
      VALUES (${folderTitle}, 'folder', ${parentId})
    `;

    safeRevalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to add folder:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Adds a new credential vault item (password, note, card, credential) to the database.
 */
export async function addCredentialItem(item: {
  title: string;
  type: "password" | "note" | "card" | "credential";
  username?: string;
  secret: string; // Encrypted text
  url?: string;
  notes?: string;
  parentId: string | null;
}) {
  try {
    const title = item.title.trim();
    const type = item.type;
    const username = item.username?.trim() || null;
    const secret = item.secret;
    const url = item.url?.trim() || null;
    const notes = item.notes?.trim() || null;
    const parentId = item.parentId;

    if (!title || !secret) {
      return { success: false, error: "Title and encrypted secret are required." };
    }

    await sql`
      INSERT INTO vault_items (title, type, username, secret, url, notes, parent_id)
      VALUES (${title}, ${type}, ${username}, ${secret}, ${url}, ${notes}, ${parentId})
    `;

    safeRevalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to add credential item:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Uploads a document directly via Server Action to bypass browser CORS policies.
 */
export async function uploadDocumentDirect(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    const customTitle = formData.get("title") as string;
    const customNotes = formData.get("notes") as string;
    const parentId = (formData.get("parentId") as string) || null;

    if (!file) {
      return { success: false, error: "No file selected." };
    }

    const title = customTitle?.trim() || file.name;
    const notes = customNotes?.trim() || null;
    const fileType = file.type || "application/octet-stream";
    const fileSize = file.size;

    const fileId = crypto.randomUUID();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storageKey = `vault-docs/${fileId}-${sanitizedName}`;

    // Convert file arrayBuffer to Buffer for S3 upload
    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. Upload to Cloudflare R2 on server side (No CORS limits!)
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
        Body: buffer,
        ContentType: fileType,
      })
    );

    // 2. Save metadata in NeonDB
    await sql`
      INSERT INTO vault_items (title, type, file_name, file_type, file_size, storage_key, notes, parent_id)
      VALUES (${title}, 'document', ${file.name}, ${fileType}, ${fileSize}, ${storageKey}, ${notes}, ${parentId})
    `;

    safeRevalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to upload document via server action:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Generates a presigned URL to upload a document directly to Cloudflare R2 from the client browser.
 */
export async function getPresignedUploadUrl(fileName: string, fileType: string) {
  try {
    if (!fileName || !fileType) {
      return { success: false, error: "File name and file type are required." };
    }

    const fileId = crypto.randomUUID();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storageKey = `vault-docs/${fileId}-${sanitizedName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    return { success: true, uploadUrl, storageKey };
  } catch (error: any) {
    console.error("Failed to generate presigned upload URL:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Saves the metadata of a successfully uploaded document to NeonDB.
 */
export async function addDocumentMetadata(item: {
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  notes?: string;
  parentId: string | null;
}) {
  try {
    const title = item.title.trim();
    const fileName = item.fileName;
    const fileType = item.fileType;
    const fileSize = item.fileSize;
    const storageKey = item.storageKey;
    const notes = item.notes?.trim() || null;
    const parentId = item.parentId;

    if (!title || !fileName || !storageKey) {
      return { success: false, error: "Title, file name, and storage key are required." };
    }

    await sql`
      INSERT INTO vault_items (title, type, file_name, file_type, file_size, storage_key, notes, parent_id)
      VALUES (${title}, 'document', ${fileName}, ${fileType}, ${fileSize}, ${storageKey}, ${notes}, ${parentId})
    `;

    safeRevalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to save document metadata:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Generates a presigned URL specifically for in-browser previewing (inline display).
 * Does NOT force file download.
 */
export async function getPresignedViewUrl(storageKey: string, fileName: string) {
  try {
    if (!storageKey || !fileName) {
      return { success: false, error: "Storage key and file name are required." };
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      ResponseContentDisposition: "inline",
    });

    const viewUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

    return { success: true, viewUrl };
  } catch (error: any) {
    console.error("Failed to generate presigned view URL:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Generates a temporary presigned download URL for a document in R2.
 */
export async function getPresignedDownloadUrl(storageKey: string, fileName: string) {
  try {
    if (!storageKey || !fileName) {
      return { success: false, error: "Storage key and file name are required." };
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return { success: true, downloadUrl };
  } catch (error: any) {
    console.error("Failed to generate presigned download URL:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Recursive helper to collect all descendant documents of a folder.
 */
async function collectFolderDocuments(folderId: string): Promise<{ id: string; storage_key: string | null }[]> {
  const documents: { id: string; storage_key: string | null }[] = [];
  
  const children = await sql`
    SELECT id, type, storage_key 
    FROM vault_items 
    WHERE parent_id = ${folderId}
  `;
  
  for (const child of (children as any[])) {
    if (child.type === "document") {
      documents.push({ id: child.id, storage_key: child.storage_key });
    } else if (child.type === "folder") {
      const subdocs = await collectFolderDocuments(child.id);
      documents.push(...subdocs);
    }
  }
  
  return documents;
}

/**
 * Helper to recursively delete an item and all its subfolders/files bottom-up.
 */
async function deleteVaultItemRecursive(id: string) {
  // Fetch children first and delete them recursively
  const children = await sql`
    SELECT id FROM vault_items WHERE parent_id = ${id}
  `;
  for (const child of children as any[]) {
    await deleteVaultItemRecursive(child.id);
  }

  // Fetch item storage_key to clean R2
  const items = await sql`
    SELECT id, storage_key FROM vault_items WHERE id = ${id}
  `;
  if (items.length > 0) {
    const item = items[0] as any;
    if (item.storage_key) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: item.storage_key,
          })
        );
      } catch (e) {
        console.warn(`Failed to delete R2 file (${item.storage_key}):`, e);
      }
    }
    await sql`
      DELETE FROM vault_items WHERE id = ${id}
    `;
  }
}

/**
 * Deletes a vault item. If it is a folder, recursively deletes all children and their R2 files.
 */
export async function deleteVaultItem(id: string) {
  try {
    if (!id) {
      return { success: false, error: "Item ID is required." };
    }

    await deleteVaultItemRecursive(id);

    safeRevalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete vault item:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Renames a vault item.
 */
export async function renameVaultItem(id: string, newTitle: string) {
  try {
    const title = newTitle.trim();
    if (!title) {
      return { success: false, error: "Name cannot be empty." };
    }

    // Fetch the item first to see if it's a file
    const items = await sql`SELECT type, file_name FROM vault_items WHERE id = ${id}`;
    if (items.length === 0) {
      return { success: false, error: "Item not found." };
    }
    const item = items[0] as any;

    if (item.type === "document" && item.file_name) {
      // For documents, keep the extension when renaming the visual title, 
      // or if they change the extension, we adapt
      const oldExt = item.file_name.split('.').pop() || '';
      const newExt = title.split('.').pop() || '';
      
      let updatedFileName = title;
      if (oldExt && oldExt !== newExt) {
        updatedFileName = `${title}.${oldExt}`;
      }

      await sql`
        UPDATE vault_items
        SET title = ${title}, file_name = ${updatedFileName}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
    } else {
      await sql`
        UPDATE vault_items
        SET title = ${title}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
    }

    safeRevalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to rename item:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Moves an item to a different parent folder.
 * Prevents moving a folder into itself or its own descendants.
 */
export async function moveVaultItem(id: string, targetParentId: string | null) {
  try {
    if (id === targetParentId) {
      return { success: false, error: "Cannot move a folder into itself." };
    }

    // If target parent is not root, check for circular loop (moving folder into its descendant)
    if (targetParentId !== null) {
      let checkParentId: string | null = targetParentId;
      while (checkParentId !== null) {
        if (checkParentId === id) {
          return { success: false, error: "Cannot move a folder into its own subfolder." };
        }
        const parents: any = await sql`SELECT parent_id FROM vault_items WHERE id = ${checkParentId}`;
        if (parents.length === 0) break;
        checkParentId = (parents[0] as any).parent_id;
      }
    }

    await sql`
      UPDATE vault_items
      SET parent_id = ${targetParentId}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    safeRevalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to move item:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Recursive helper to copy a folder structure and duplicate files in Cloudflare R2.
 */
async function copyFolderRecursive(folderId: string, targetParentId: string | null): Promise<string> {
  const folders = await sql`SELECT title FROM vault_items WHERE id = ${folderId}`;
  if (folders.length === 0) throw new Error("Folder not found");
  const folder = folders[0] as any;
  
  const newFolderId = crypto.randomUUID();
  await sql`
    INSERT INTO vault_items (id, title, type, parent_id)
    VALUES (${newFolderId}, ${folder.title + " (Copy)"}, 'folder', ${targetParentId})
  `;
  
  const children = await sql`
    SELECT id, title, type, username, secret, url, notes, file_name, file_type, file_size, storage_key 
    FROM vault_items 
    WHERE parent_id = ${folderId}
  `;
  
  for (const child of (children as any[])) {
    if (child.type === "folder") {
      await copyFolderRecursive(child.id, newFolderId);
    } else if (child.type === "document") {
      if (child.storage_key) {
        const fileId = crypto.randomUUID();
        const newKey = `vault-docs/${fileId}-${child.file_name}`;
        
        // Duplicate object in R2
        await s3.send(new CopyObjectCommand({
          Bucket: BUCKET_NAME,
          CopySource: `${BUCKET_NAME}/${child.storage_key}`,
          Key: newKey,
        }));
        
        await sql`
          INSERT INTO vault_items (title, type, file_name, file_type, file_size, storage_key, notes, parent_id)
          VALUES (${child.title + " (Copy)"}, 'document', ${child.file_name}, ${child.file_type}, ${child.file_size}, ${newKey}, ${child.notes}, ${newFolderId})
        `;
      }
    } else {
      // Credential (password/note)
      await sql`
        INSERT INTO vault_items (title, type, username, secret, url, notes, parent_id)
        VALUES (${child.title + " (Copy)"}, ${child.type}, ${child.username}, ${child.secret}, ${child.url}, ${child.notes}, ${newFolderId})
      `;
    }
  }
  
  return newFolderId;
}

/**
 * Copies a vault item. Duplicates files in Cloudflare R2 if it is a document.
 */
export async function copyVaultItem(id: string, targetParentId: string | null) {
  try {
    const items = await sql`
      SELECT id, title, type, username, secret, url, notes, file_name, file_type, file_size, storage_key
      FROM vault_items
      WHERE id = ${id}
    `;

    if (items.length === 0) {
      return { success: false, error: "Item not found." };
    }

    const item = items[0] as any;

    if (item.type === "folder") {
      await copyFolderRecursive(id, targetParentId);
    } else if (item.type === "document") {
      if (item.storage_key) {
        const fileId = crypto.randomUUID();
        const newKey = `vault-docs/${fileId}-${item.file_name}`;
        
        // Copy in R2
        await s3.send(new CopyObjectCommand({
          Bucket: BUCKET_NAME,
          CopySource: `${BUCKET_NAME}/${item.storage_key}`,
          Key: newKey,
        }));

        // Insert database metadata record
        await sql`
          INSERT INTO vault_items (title, type, file_name, file_type, file_size, storage_key, notes, parent_id)
          VALUES (${item.title + " (Copy)"}, 'document', ${item.file_name}, ${item.file_type}, ${item.file_size}, ${newKey}, ${item.notes}, ${targetParentId})
        `;
      }
    } else {
      // Standard credentials
      await sql`
        INSERT INTO vault_items (title, type, username, secret, url, notes, parent_id)
        VALUES (${item.title + " (Copy)"}, ${item.type}, ${item.username}, ${item.secret}, ${item.url}, ${item.notes}, ${targetParentId})
      `;
    }

    safeRevalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to copy item:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches the master password verification token from the database if one exists.
 */
export async function getMasterVerificationToken() {
  try {
    const items = await sql`
      SELECT secret FROM vault_items WHERE type = 'vault_verification' LIMIT 1
    `;
    if (items.length > 0 && (items[0] as any).secret) {
      return { success: true, token: (items[0] as any).secret as string };
    }
    return { success: true, token: null };
  } catch (error: any) {
    console.error("Failed to fetch master verification token:", error);
    return { success: false, error: error.message, token: null };
  }
}

/**
 * Saves a new encrypted master password verification token.
 */
export async function setMasterVerificationToken(encryptedToken: string) {
  try {
    await sql`
      DELETE FROM vault_items WHERE type = 'vault_verification'
    `;
    await sql`
      INSERT INTO vault_items (title, type, secret)
      VALUES ('MASTER_VERIFICATION_TOKEN', 'vault_verification', ${encryptedToken})
    `;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to set master verification token:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Resets the master password verification token (used for vault reset or password changes).
 */
export async function resetMasterVerificationToken() {
  try {
    await sql`
      DELETE FROM vault_items WHERE type = 'vault_verification'
    `;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to reset master verification token:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Searches vault items using Searchable Symmetric Encryption (SSE) blind index tokens.
 */
export async function searchVaultItemsByBlindToken(blindTokenHex: string) {
  try {
    const pattern = `%${blindTokenHex}%`;
    const items = await sql`
      SELECT id, title, type, username, secret, url, notes, file_name, file_type, file_size, storage_key, parent_id, created_at, updated_at
      FROM vault_items
      WHERE blind_index_tokens LIKE ${pattern} AND type != 'vault_verification'
      ORDER BY created_at DESC
    `;
    return { success: true, data: items as unknown as VaultItem[] };
  } catch (error: any) {
    console.error("Failed to search by blind token:", error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Toggles favorite state of a vault item.
 */
export async function toggleFavoriteItem(id: string) {
  try {
    await sql`
      UPDATE vault_items
      SET is_favorite = NOT COALESCE(is_favorite, FALSE),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    return { success: true };
  } catch (error: any) {
    console.error("Failed to toggle favorite:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Updates item status ('active' | 'archived' | 'trash').
 */
async function setItemStatusRecursive(id: string, status: "active" | "archived" | "trash") {
  await sql`
    UPDATE vault_items
    SET status = ${status},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;
  const children = await sql`
    SELECT id FROM vault_items WHERE parent_id = ${id}
  `;
  for (const child of children as any[]) {
    await setItemStatusRecursive(child.id, status);
  }
}

/**
 * Updates the status of an item ('active' | 'archived' | 'trash') and all its children recursively.
 */
export async function setItemStatus(id: string, status: "active" | "archived" | "trash") {
  try {
    await setItemStatusRecursive(id, status);
    safeRevalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update item status:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches all items marked as Favorite.
 */
export async function getFavoriteItems() {
  try {
    const items = await sql`
      SELECT id, title, type, username, secret, url, notes, file_name, file_type, file_size, storage_key, parent_id, is_favorite, COALESCE(status, 'active') as status, created_at, updated_at
      FROM vault_items
      WHERE is_favorite = TRUE AND (status = 'active' OR status IS NULL) AND type != 'vault_verification'
      ORDER BY updated_at DESC
    `;
    return { success: true, data: items as unknown as VaultItem[] };
  } catch (error: any) {
    console.error("Failed to fetch favorite items:", error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Fetches all Archived items.
 */
export async function getArchivedItems() {
  try {
    const items = await sql`
      SELECT id, title, type, username, secret, url, notes, file_name, file_type, file_size, storage_key, parent_id, is_favorite, COALESCE(status, 'active') as status, created_at, updated_at
      FROM vault_items
      WHERE status = 'archived' AND type != 'vault_verification'
      ORDER BY updated_at DESC
    `;
    return { success: true, data: items as unknown as VaultItem[] };
  } catch (error: any) {
    console.error("Failed to fetch archived items:", error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Fetches all Trash items.
 */
export async function getTrashItems() {
  try {
    const items = await sql`
      SELECT id, title, type, username, secret, url, notes, file_name, file_type, file_size, storage_key, parent_id, is_favorite, COALESCE(status, 'active') as status, created_at, updated_at
      FROM vault_items
      WHERE status = 'trash' AND type != 'vault_verification'
      ORDER BY updated_at DESC
    `;
    return { success: true, data: items as unknown as VaultItem[] };
  } catch (error: any) {
    console.error("Failed to fetch trash items:", error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Permanently deletes all items in the Trash bin.
 */
export async function emptyTrash() {
  try {
    const trashItems = await sql`
      SELECT id FROM vault_items WHERE status = 'trash' AND type != 'vault_verification'
    `;
    for (const item of trashItems as any[]) {
      await deleteVaultItem(item.id);
    }
    safeRevalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to empty trash:", error);
    return { success: false, error: error.message };
  }
}


