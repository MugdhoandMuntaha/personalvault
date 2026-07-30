# Personal Vault — Project Progress & Implementation Manual

**Project Name:** Personal Vault  
**Repository:** [MugdhoandMuntaha/personalvault](https://github.com/MugdhoandMuntaha/personalvault)  
**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, NeonDB (PostgreSQL), Cloudflare R2 (S3-compatible Object Storage), `@aws-sdk/client-s3`, OWASP Cryptography (`crypto.subtle`).  
**Last Updated:** July 30, 2026  

---

## 📌 Executive Summary

Personal Vault is an ultra-secure, formal emerald-themed web application for managing private documents, credentials, passwords, and encrypted secret notes. It leverages **NeonDB** for structured metadata and folder hierarchy, **Cloudflare R2** for fast document storage, and **Web Crypto APIs** for zero-knowledge client-side encryption.

---

## 🚀 Completed Features & Milestones

### 1. Database & Infrastructure Setup
- [x] Integrated **NeonDB Serverless PostgreSQL** via `@neondatabase/serverless`.
- [x] Built auto-migration routines in `initDatabase()` creating tables for `vault_items` and `folders`.
- [x] Configured **Cloudflare R2 Object Storage** using `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
- [x] Bypassed R2 CORS restrictions by creating `uploadDocumentDirect(formData)` streaming files directly through Next.js Server Actions with a 100MB body size limit.

### 2. Zero-Knowledge Cryptography & Security Hardening
- [x] Upgraded PBKDF2 key derivation in `lib/crypto.ts` to **600,000 iterations of HMAC-SHA512** (OWASP 2026 compliant standard).
- [x] Derived 256-bit AES-GCM symmetric keys with 128-bit authentication tags and cryptographically secure random 96-bit initialization vectors (IV).
- [x] Sanitized Lock Screen: removed auto-fill defaults, hidden plain-text password view buttons, and configured `autoComplete="new-password"`.

### 3. File Explorer & Document Previews
- [x] Built dual layout views: **Grid Card View** and **List View Table**.
- [x] Implemented file hierarchy navigation: Root Vault, nested folders, and breadcrumb path bar.
- [x] Created multi-format preview modal:
  - **PDF Documents:** Multi-engine renderer switching between Google Docs PDF Viewer (mobile browser optimized) and Native Browser PDF.
  - **Microsoft Office Docs (`.docx`, `.pptx`, `.xlsx`, `.doc`, `.ppt`, `.xls`):** Dual-engine switching between Microsoft Office Live Embed Viewer and Google Docs Viewer.
  - **Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`):** Inline responsive image viewer.
  - **Video & Audio (`.mp4`, `.mov`, `.mp3`, `.wav`):** Native HTML5 media player with `playsInline` for mobile Safari.
  - **Code & Text (`.txt`, `.json`, `.js`, `.ts`, `.py`, `.md`, `.css`, `.csv`):** Dark syntax-styled monospace code viewer.
- [x] Added **"Open in Mobile Tab"** direct link to view documents in full browser windows if mobile iframe policies restrict embedding.
- [x] Separated **Inline View Presigned URLs** (`ResponseContentDisposition: "inline"`) from **Download Presigned URLs** (`ResponseContentDisposition: "attachment"`) so previewing files never triggers automatic downloads.

### 4. Mobile Responsiveness & UI Aesthetics
- [x] Slide-over mobile navigation drawer with backdrop overlay for small screens (`lg:hidden`).
- [x] Touch-friendly buttons and breadcrumbs with horizontal scrolling.
- [x] Responsive card grid (`grid-cols-1` on phones up to `grid-cols-4` on desktop).
- [x] Granular multi-category filtering:
  - 📁 All Contents
  - 📄 PDF Documents
  - 📝 Word Files
  - 📊 PowerPoint
  - 📈 Excel Sheets
  - 🖼️ Images & Photos
  - 💻 Code & Scripts
  - 🔑 Logins & Passwords
  - 📝 Secure Notes

---

## 🛠️ Architecture & Technical Specifications

### File & Directory Structure

```
personalvault/
├── app/
│   ├── actions/
│   │   └── vault.ts            # Server Actions (NeonDB & R2 operations)
│   ├── globals.css             # Formal Emerald & White theme styling tokens
│   ├── layout.tsx              # Root Next.js layout configuration
│   └── page.tsx                # File Explorer, Lock Screen, Previews & Modals
├── lib/
│   └── crypto.ts               # OWASP PBKDF2 SHA-512 & AES-GCM crypto helpers
├── next.config.ts              # Turbopack root config & 100MB Server Action limit
├── package.json                # Project dependencies
└── progress.md                 # Technical progress and development manual
```

### Server Actions Contract (`app/actions/vault.ts`)

| Action | Parameters | Description |
| :--- | :--- | :--- |
| `initDatabase()` | None | Creates SQL tables if they do not exist. |
| `getVaultItems(folderId, filterType)` | `folderId: string \| null`, `filterType: string` | Fetches items in folder from NeonDB. |
| `getAllFolders()` | None | Fetches folder list for navigation tree. |
| `getFolderBreadcrumbs(folderId)` | `folderId: string \| null` | Computes parent breadcrumb path hierarchy. |
| `addFolder(title, parentId)` | `title: string`, `parentId: string \| null` | Creates subfolder in NeonDB. |
| `addCredentialItem(...)` | `title, username, secret, parentId` | Saves encrypted login/password or note. |
| `uploadDocumentDirect(formData)` | `FormData (file, title, parentId)` | Uploads file to R2 bucket & writes metadata to DB. |
| `getPresignedViewUrl(key, filename)` | `storageKey: string`, `fileName: string` | Generates temporary inline presigned URL (10 min expiry). |
| `getPresignedDownloadUrl(key, filename)`| `storageKey: string`, `fileName: string` | Generates attachment presigned download URL (5 min expiry). |
| `deleteVaultItem(id)` | `id: string` | Deletes item or folder recursively (including R2 objects). |
| `renameVaultItem(id, newTitle)` | `id: string`, `newTitle: string` | Updates title in NeonDB. |
| `moveVaultItem(id, targetFolderId)`| `id: string`, `targetFolderId: string \| null` | Moves item/folder to another parent directory. |
| `copyVaultItem(id, targetFolderId)`| `id: string`, `targetFolderId: string \| null` | Duplicates item/folder into target directory. |

---

## 🔮 Roadmap for Future Development

Here are recommended future enhancements for developers expanding Personal Vault:

### Phase 1: Authentication & Access Control
- [ ] **WebAuthn / Passkey Support:** Allow unlocking the vault using fingerprint, FaceID, or hardware keys (YubiKey / Windows Hello / TouchID).
- [ ] **Multi-Factor Authentication (MFA):** Add TOTP (Google Authenticator / Authy) on top of the Master Password lock screen.
- [ ] **Session Expiry Timer:** Automatically lock the vault after 5 minutes of user inactivity.

### Phase 2: End-to-End Encrypted File Storage
- [ ] **Client-Side File Encryption:** Encrypt file byte arrays in the browser using Web Crypto AES-GCM *before* uploading to R2, so Cloudflare R2 holds 100% encrypted blobs.
- [ ] **Decryption on Stream:** Decrypt file byte streams client-side upon preview or download.

### Phase 3: Vault Backup & Import/Export
- [ ] **Encrypted Vault Export:** Export all passwords, notes, and documents as a password-protected AES-256 encrypted `.vault` archive file.
- [ ] **Vault Import:** Restore contents from an exported `.vault` backup file.

### Phase 4: Advanced Search & Collaboration
- [ ] **OCR & Full-Text PDF Search:** Extract text from uploaded scanned PDFs and images to search content within files.
- [ ] **Secure Temporary Sharing Links:** Generate time-limited, password-protected public share links for individual files stored in Cloudflare R2.
- [ ] **Activity Audit Logging:** Track view, download, and modification logs per item in NeonDB for auditing.

---

## 💡 Developer Setup & Deployment Notes

1. **Environment Variables (`.env.local`):**
   ```env
   DATABASE_URL=postgresql://neondb_owner:npg_...@ep-...neon.tech/neondb?sslmode=require
   CLOUDFLARE_ACCOUNT_ID=554e8a714fb28df40a1004855a5a2017
   R2_ACCESS_KEY_ID=3af8f41433d8b0a4b261f0dca0c86671
   R2_SECRET_ACCESS_KEY=5f7a1c879f42de5e1ec7f06c1129038884dd68d3c3d75aaeded7b58844f89aca
   R2_BUCKET_NAME=personal-vault-bucket
   ```

2. **Verification Commands:**
   ```bash
   npx tsc --noEmit
   npm run build
   ```
