"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import {
  Lock,
  Unlock,
  Key,
  FileText,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Search,
  Download,
  CloudUpload,
  ShieldCheck,
  RefreshCw,
  Folder,
  FolderPlus,
  FolderOpen,
  File,
  FileImage,
  FileCode,
  FileArchive,
  ChevronRight,
  Home,
  Grid,
  List,
  X,
  MoreVertical,
  Edit3,
  Move,
  ExternalLink,
  Maximize2,
  Minimize2,
  Menu,
  Sparkles,
  Box,
  Layers,
  ShieldAlert,
  Cpu,
  GitCommit,
  FileCheck,
  Fingerprint,
  Share2,
  AlertTriangle,
  Activity,
  CheckCircle2,
  KeyRound,
  Users,
  QrCode,
  Star,
  Archive,
  RotateCcw,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react";
import { ToastContainer } from "@/components/ToastContainer";
import { toast } from "@/lib/toast";
import { CommandPalette } from "@/components/CommandPalette";
import { CheatsheetModal } from "@/components/CheatsheetModal";
import { IDEStatusBar } from "@/components/IDEStatusBar";
import { DeveloperEditor } from "@/components/DeveloperEditor";
import { GitDiffViewer } from "@/components/GitDiffViewer";
import { FuturisticSidebar } from "@/components/FuturisticSidebar";
import {
  initDatabase,
  getVaultItems,
  getAllFolders,
  getFolderBreadcrumbs,
  addFolder,
  addCredentialItem,
  uploadDocumentDirect,
  getPresignedUploadUrl,
  startChunkedUpload,
  uploadChunk,
  completeChunkedUpload,
  abortChunkedUpload,
  addDocumentMetadata,
  getPresignedViewUrl,
  getPresignedDownloadUrl,
  deleteVaultItem,
  renameVaultItem,
  moveVaultItem,
  copyVaultItem,
  getMasterVerificationToken,
  setMasterVerificationToken,
  resetMasterVerificationToken,
  searchVaultItemsByBlindToken,
  toggleFavoriteItem,
  setItemStatus,
  getFavoriteItems,
  getArchivedItems,
  getTrashItems,
  emptyTrash,
  VaultItem,
} from "@/app/actions/vault";
import { deriveKey, encryptText, decryptText } from "@/lib/crypto";
import { splitSecret, combineShares, ShamirShare } from "@/lib/shamir";
import { generateKyberKeyPair, pqcHybridEncrypt, pqcHybridDecrypt, PQCKeyPair } from "@/lib/pqc";
import { deriveSearchKey, generateBlindToken } from "@/lib/sse";
import { createZKCommitment, generateZKProof, verifyZKProof, ZKProofPayload } from "@/lib/zkp";
import { isWebAuthnSupported, registerHardwareKey, getHardwareEntropy, strengthenKeyWithHardwareSecret } from "@/lib/webauthn";
import { calculateAuditHash, verifyAuditChain, AuditLogEntry } from "@/lib/audit";
import { addAuditLogEntry, getAuditLogs, getLatestAuditHash } from "@/app/actions/audit";
import { recordAccessAttempt, evaluateAccessAnomaly, getAccessHistory, AnomalyReport } from "@/lib/anomaly";
import { generateUserKeyPair, encryptItemForRecipient, decryptSharedItem, UserKeyPair, SharedItemPayload } from "@/lib/sharing";
import { registerPublicKey, getPublicKey, shareItemWithUser, getSharedItemsForUser } from "@/app/actions/sharing";
import { checkPasswordBreach, analyzePasswordHealth, PasswordHealthReport } from "@/lib/breach";

export default function FormalGreenWhiteVault() {
  const [isLocked, setIsLocked] = useState(true);
  const [masterPassword, setMasterPassword] = useState("");
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  // Theme state: glass, neo, clay
  type UITheme = "glass" | "neo" | "clay";
  const [uiTheme, setUiTheme] = useState<UITheme>("glass");

  useEffect(() => {
    const saved = localStorage.getItem("personal_vault_ui_theme") as UITheme;
    if (saved && ["glass", "neo", "clay"].includes(saved)) {
      setUiTheme(saved);
    }
  }, []);

  const handleThemeChange = (newTheme: UITheme) => {
    setUiTheme(newTheme);
    localStorage.setItem("personal_vault_ui_theme", newTheme);
  };

  // Navigation & View state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; title: string }[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  type FilterCategory = "all" | "document" | "pdf" | "word" | "pptx" | "excel" | "image" | "code" | "password" | "note";
  const [filterType, setFilterType] = useState<FilterCategory>("all");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Items & folders cache
  const [items, setItems] = useState<VaultItem[]>([]);
  const [allFolders, setAllFolders] = useState<{ id: string; title: string; parent_id: string | null }[]>([]);
  const [isPending, startTransition] = useTransition();

  // Advanced Security Suite Modal State
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  type SecurityTab = "sss" | "pqc" | "audit" | "zkp" | "webauthn" | "ids" | "sharing" | "breach";
  const [securityTab, setSecurityTab] = useState<SecurityTab>("sss");

  // SSS Emergency Recovery state
  const [shamirShares, setShamirShares] = useState<ShamirShare[]>([]);
  const [recoveryInputShares, setRecoveryInputShares] = useState<string>("");
  const [recoveryError, setRecoveryError] = useState("");
  const [showRecoveryOnLock, setShowRecoveryOnLock] = useState(false);

  // PQC & Hardware state
  const [pqcKeyPair, setPqcKeyPair] = useState<PQCKeyPair | null>(null);
  const [hardwareCred, setHardwareCred] = useState<any | null>(null);

  // Audit Logs state
  const [auditLogsList, setAuditLogsList] = useState<AuditLogEntry[]>([]);
  const [auditVerification, setAuditVerification] = useState<{ valid: boolean; errorReason?: string | null } | null>(null);

  // ZK Proofs state
  const [zkProofPayload, setZkProofPayload] = useState<ZKProofPayload | null>(null);
  const [zkVerifyResult, setZkVerifyResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Anomaly IDS state
  const [anomalyReport, setAnomalyReport] = useState<AnomalyReport | null>(null);

  // E2EE Sharing state
  const [sharingKeyPair, setSharingKeyPair] = useState<UserKeyPair | null>(null);
  const [recipientUsername, setRecipientUsername] = useState("");
  const [shareItemTitle, setShareItemTitle] = useState("");
  const [shareItemSecret, setShareItemSecret] = useState("");
  const [sharedReceivedItems, setSharedReceivedItems] = useState<any[]>([]);

  // Password Breach state
  const [breachReport, setBreachReport] = useState<PasswordHealthReport | null>(null);
  const [isBreachLoading, setIsBreachLoading] = useState(false);

  // Modals state
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [addRecordModalOpen, setAddRecordModalOpen] = useState(false);
  const [recordTab, setRecordTab] = useState<"password" | "note" | "document">("document");

  const [renameItem, setRenameItem] = useState<VaultItem | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const [moveItem, setMoveItem] = useState<VaultItem | null>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null);

  const [previewItem, setPreviewItem] = useState<VaultItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDecryptedText, setPreviewDecryptedText] = useState<string | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);
  const [pdfViewerEngine, setPdfViewerEngine] = useState<"google" | "native">("google");
  const [officeViewerEngine, setOfficeViewerEngine] = useState<"office" | "google">("office");

  // Form states
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [secretPassword, setSecretPassword] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatusText, setUploadStatusText] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);

  // Decrypted cache & Feedback
  const [decryptedCache, setDecryptedCache] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  // IDE & Power Feature states
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [splitEditorOpen, setSplitEditorOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [editorCursorPos, setEditorCursorPos] = useState({ line: 1, col: 1 });

  // Confirmation Modals state
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<VaultItem | null>(null);
  const [emptyTrashConfirmOpen, setEmptyTrashConfirmOpen] = useState(false);

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInputActive = activeTag === "input" || activeTag === "textarea";

      // Cmd/Ctrl + K or Cmd/Ctrl + P -> Command Palette
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "p")) {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Cmd/Ctrl + Shift + F -> Global Search / Command Palette Search
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Cmd/Ctrl + B -> Toggle Sidebar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
        return;
      }

      // Cmd/Ctrl + \ -> Split Editor
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSplitEditorOpen((prev) => !prev);
        toast.info(splitEditorOpen ? "Split View closed" : "Split View enabled", "IDE Shortcut");
        return;
      }

      // Cmd/Ctrl + L -> Quick Lock
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setIsLocked(true);
        toast.warning("Vault locked via hotkey", "Security");
        return;
      }

      // Cmd/Ctrl + Shift + Z -> Zen Mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        setIsZenMode((prev) => !prev);
        toast.info(!isZenMode ? "Zen Mode Enabled (Distraction-Free)" : "Zen Mode Disabled", "Zen Editor");
        return;
      }

      // ? or Cmd/Ctrl + / -> Cheatsheet (when not typing in an input)
      if ((e.key === "?" && !isInputActive) || ((e.metaKey || e.ctrlKey) && e.key === "/")) {
        e.preventDefault();
        setCheatsheetOpen((prev) => !prev);
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [sidebarCollapsed, splitEditorOpen, isZenMode]);

  // Active View Section: vault, favorites, archive, trash
  type ActiveSection = "vault" | "favorites" | "archive" | "trash";
  const [activeSection, setActiveSection] = useState<ActiveSection>("vault");

  // Drag and Drop state
  const [draggedItem, setDraggedItem] = useState<VaultItem | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Init DB
  useEffect(() => {
    initDatabase();
  }, []);

  // Fetch items based on activeSection & currentFolderId
  const fetchCurrentContents = () => {
    startTransition(async () => {
      let res;
      if (activeSection === "favorites") {
        res = await getFavoriteItems();
      } else if (activeSection === "archive") {
        res = await getArchivedItems();
      } else if (activeSection === "trash") {
        res = await getTrashItems();
      } else {
        res = await getVaultItems(currentFolderId);
      }

      if (res.success && res.data) {
        setItems(res.data);
      }
      const foldersRes = await getAllFolders();
      if (foldersRes.success && foldersRes.data) {
        setAllFolders(foldersRes.data);
      }
      if (activeSection === "vault") {
        const crumbsRes = await getFolderBreadcrumbs(currentFolderId);
        if (crumbsRes.success && crumbsRes.data) {
          setBreadcrumbs(crumbsRes.data);
        }
      }
    });
  };

  useEffect(() => {
    if (!isLocked) {
      fetchCurrentContents();
    }
  }, [currentFolderId, activeSection, isLocked]);

  // Action Handlers for Favorites, Archive, Trash, & Drag-and-Drop
  const handleToggleFavorite = async (item: VaultItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const res = await toggleFavoriteItem(item.id);
    if (res.success) {
      fetchCurrentContents();
    } else {
      alert("Failed to toggle favorite: " + res.error);
    }
  };

  const handleSetStatusDirect = async (item: VaultItem, status: "active" | "archived" | "trash") => {
    const res = await setItemStatus(item.id, status);
    if (res.success) {
      fetchCurrentContents();
    } else {
      alert("Failed to update item status: " + res.error);
    }
  };

  const handleSetStatus = async (item: VaultItem, status: "active" | "archived" | "trash", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (status === "trash") {
      setDeleteConfirmItem(item);
    } else {
      await handleSetStatusDirect(item, status);
    }
  };

  const handleEmptyTrashDirect = async () => {
    const res = await emptyTrash();
    if (res.success) {
      fetchCurrentContents();
    } else {
      alert("Failed to empty trash: " + res.error);
    }
  };

  const handleEmptyTrash = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEmptyTrashConfirmOpen(true);
  };

  const handleDragStart = (e: React.DragEvent, item: VaultItem) => {
    e.stopPropagation();
    setDraggedItem(item);
    e.dataTransfer.setData("text/plain", item.id);
  };

  const handleDragOverFolder = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(folderId);
  };

  const handleDropOnFolder = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    if (!draggedItem) return;
    if (draggedItem.id === targetFolderId) return;

    const res = await moveVaultItem(draggedItem.id, targetFolderId);
    if (res.success) {
      fetchCurrentContents();
    } else {
      alert("Failed to move item: " + res.error);
    }
    setDraggedItem(null);
  };

  const VERIFICATION_MAGIC_STRING = "PERSONAL_VAULT_MASTER_VERIFICATION_TOKEN_2026";

  // Emergency Recovery via Shamir's Secret Sharing (SSS K-of-N Assembly)
  const handleShamirUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryInputShares.trim()) {
      setRecoveryError("Please enter at least K secret shares.");
      return;
    }
    setRecoveryError("");

    try {
      const lines = recoveryInputShares.split("\n").map((l) => l.trim()).filter(Boolean);
      const parsedShares: ShamirShare[] = lines.map((line) => {
        const parts = line.split(":");
        if (parts.length < 2) {
          throw new Error("Invalid share format. Expected 'shareID:shareHex' (e.g., 1:a1b2c3...)");
        }
        return { id: parseInt(parts[0], 10), shareHex: parts[1].trim() };
      });

      const recoveredHex = combineShares(parsedShares);
      const bytes = new Uint8Array(recoveredHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || []);
      const recoveredPassword = new TextDecoder().decode(bytes);

      const key = await deriveKey(recoveredPassword);
      setCryptoKey(key);
      setMasterPassword(recoveredPassword);
      setIsLocked(false);
      setShowRecoveryOnLock(false);
    } catch (err: any) {
      setRecoveryError("Emergency Share Reconstruction Failed: " + err.message);
    }
  };

  const handleGenerateShamirShares = (threshold: number = 3, totalShares: number = 5) => {
    if (!masterPassword) {
      alert("Master Password is required to generate recovery shares.");
      return;
    }
    const encBytes = new TextEncoder().encode(masterPassword);
    const hex = Array.from(encBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const shares = splitSecret(hex, totalShares, threshold);
    setShamirShares(shares);
  };

  const handleFetchAuditLogs = async () => {
    const res = await getAuditLogs();
    if (res.success && res.logs) {
      setAuditLogsList(res.logs as any);
      const verification = await verifyAuditChain(res.logs as any);
      setAuditVerification(verification);
    }
  };

  const handleRunAnomalyAudit = () => {
    const currentAttempt: any = {
      timestamp: Date.now(),
      hourOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      success: true,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
      screenResolution: typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : "Unknown",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    };
    const report = evaluateAccessAnomaly(currentAttempt);
    setAnomalyReport(report);
  };

  // Handle Master Password Unlock with Strict Verification & Audit Log Chain
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword.trim()) {
      setUnlockError("Please enter your master password.");
      return;
    }
    setIsUnlocking(true);
    setUnlockError("");

    try {
      // 1. Derive AES-GCM 256-bit Key from Master Password
      const key = await deriveKey(masterPassword);

      // 2. Fetch existing verification token from DB
      const res = await getMasterVerificationToken();

      if (res.success && res.token) {
        // Verification token exists — Attempt to decrypt to verify password correctness
        try {
          const decrypted = await decryptText(res.token, key);
          if (decrypted !== VERIFICATION_MAGIC_STRING) {
            recordAccessAttempt(false);
            const prevHash = await getLatestAuditHash();
            const newHash = await calculateAuditHash(prevHash, "SECURITY_ALERT", "Failed unlock attempt", new Date().toISOString());
            await addAuditLogEntry("SECURITY_ALERT", "Failed unlock attempt", newHash, prevHash);
            setUnlockError("Incorrect master password. Access denied.");
            setIsUnlocking(false);
            return;
          }
        } catch (decryptErr) {
          recordAccessAttempt(false);
          const prevHash = await getLatestAuditHash();
          const newHash = await calculateAuditHash(prevHash, "SECURITY_ALERT", "Failed unlock attempt", new Date().toISOString());
          await addAuditLogEntry("SECURITY_ALERT", "Failed unlock attempt", newHash, prevHash);
          setUnlockError("Incorrect master password. Access denied.");
          setIsUnlocking(false);
          return;
        }
      } else {
        // No verification token in DB yet — Set this password as the vault's Master Password!
        const encryptedVerification = await encryptText(VERIFICATION_MAGIC_STRING, key);
        await setMasterVerificationToken(encryptedVerification);
      }

      // Password verified! Record access and append to Merkle audit chain
      recordAccessAttempt(true);
      const prevHash = await getLatestAuditHash();
      const newHash = await calculateAuditHash(prevHash, "VAULT_UNLOCK", "Master Password Verified", new Date().toISOString());
      await addAuditLogEntry("VAULT_UNLOCK", "Master Password Verified", newHash, prevHash);

      setCryptoKey(key);
      setIsLocked(false);
    } catch (err: any) {
      setUnlockError("Security verification failed: " + (err.message || "Unknown error"));
    } finally {
      setIsUnlocking(false);
    }
  };

  // Option to reset vault master password verification
  const handleResetVaultPassword = async () => {
    if (confirm("Resetting your Master Password lock will allow setting a new Master Password on next unlock.\n\nAre you sure you want to proceed?")) {
      const res = await resetMasterVerificationToken();
      if (res.success) {
        alert("Master password verification reset successfully. Enter your new Master Password to lock the vault with it.");
        setUnlockError("");
      } else {
        alert("Reset failed: " + res.error);
      }
    }
  };

  const handleLock = () => {
    setIsLocked(true);
    setCryptoKey(null);
    setDecryptedCache({});
    setItems([]);
    setCurrentFolderId(null);
  };

  // Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const res = await addFolder(newFolderName, currentFolderId);
    if (res.success) {
      setNewFolderName("");
      setNewFolderModalOpen(false);
      fetchCurrentContents();
    } else {
      alert("Failed to create folder: " + res.error);
    }
  };

  // Add Credential
  const handleAddCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !cryptoKey) return;
    if (recordTab !== "password" && recordTab !== "note") return;

    setIsAdding(true);
    try {
      const plaintext = recordTab === "password" ? secretPassword : noteContent;
      if (!plaintext) {
        alert("Please enter password or note content.");
        setIsAdding(false);
        return;
      }

      const encryptedSecret = await encryptText(plaintext, cryptoKey);

      const res = await addCredentialItem({
        title,
        type: recordTab,
        username: recordTab === "password" ? username : undefined,
        secret: encryptedSecret,
        url: recordTab === "password" ? websiteUrl : undefined,
        notes,
        parentId: currentFolderId,
      });

      if (res.success) {
        setTitle("");
        setUsername("");
        setSecretPassword("");
        setWebsiteUrl("");
        setNoteContent("");
        setNotes("");
        setAddRecordModalOpen(false);
        fetchCurrentContents();
      } else {
        alert("Failed to save: " + res.error);
      }
    } catch (err: any) {
      alert("Save failed: " + err.message);
    } finally {
      setIsAdding(false);
    }
  };

  // Add Document Upload: Supports single or multiple file batch uploads (files <= 4.2MB via direct action, > 4.2MB via presigned URL)
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    const filesToUpload = selectedFiles.length > 0 ? selectedFiles : (selectedFile ? [selectedFile] : []);
    if (filesToUpload.length === 0) return alert("Please select at least one document to upload.");

    setIsAdding(true);
    setUploadProgress(0);
    setUploadStatusText("");

    const VERCEL_MAX_DIRECT_SIZE = 4.2 * 1024 * 1024; // 4.2 MB safe threshold for Vercel
    let successCount = 0;

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const fileType = file.type || "application/octet-stream";
        // If single file selected, custom title can override. If multiple, file name is used.
        const fileTitle = filesToUpload.length === 1 && title.trim() ? title.trim() : file.name;
        
        setUploadStatusText(`Uploading ${i + 1} of ${filesToUpload.length}: ${file.name}`);
        const baseProgress = Math.round((i / filesToUpload.length) * 100);
        setUploadProgress(baseProgress);

        if (file.size <= VERCEL_MAX_DIRECT_SIZE) {
          // Direct server action for files <= 4.2 MB
          const formData = new FormData();
          formData.append("file", file);
          if (fileTitle) formData.append("title", fileTitle);
          if (notes) formData.append("notes", notes);
          if (currentFolderId) formData.append("parentId", currentFolderId);

          const res = await uploadDocumentDirect(formData);
          if (!res.success) {
            throw new Error(`Failed to upload ${file.name}: ${res.error || "Upload failed."}`);
          }
        } else {
          // Presigned R2 URL for files > 4.2 MB
          const presignedRes = await getPresignedUploadUrl(file.name, fileType);
          if (!presignedRes.success || !presignedRes.uploadUrl || !presignedRes.storageKey) {
            throw new Error(presignedRes.error || `Failed to generate upload URL for ${file.name}.`);
          }

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", presignedRes.uploadUrl, true);
            xhr.setRequestHeader("Content-Type", fileType);

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const itemPercent = event.loaded / event.total;
                const totalPercent = Math.round(((i + itemPercent) / filesToUpload.length) * 100);
                setUploadProgress(totalPercent);
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
              } else {
                reject(new Error(`Storage upload failed for ${file.name} (HTTP ${xhr.status}). Check Cloudflare R2 CORS settings.`));
              }
            };

            xhr.onerror = () => reject(new Error(`CORS policy blocked upload for ${file.name}. Please ensure CORS rules are enabled in your Cloudflare R2 bucket.`));
            xhr.ontimeout = () => reject(new Error(`Upload request timed out for ${file.name}.`));

            xhr.send(file);
          });

          const metaRes = await addDocumentMetadata({
            title: fileTitle,
            fileName: file.name,
            fileType: fileType,
            fileSize: file.size,
            storageKey: presignedRes.storageKey,
            notes: notes || undefined,
            parentId: currentFolderId,
          });

          if (!metaRes.success) {
            throw new Error(metaRes.error || `Failed to save metadata for ${file.name}.`);
          }
        }

        successCount++;
        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100));
      }

      toast.success(`${successCount} document${successCount > 1 ? "s" : ""} uploaded successfully!`, "Vault");
      setTitle("");
      setSelectedFile(null);
      setSelectedFiles([]);
      setNotes("");
      setAddRecordModalOpen(false);
      fetchCurrentContents();
    } catch (err: any) {
      console.error("Multi-upload failed:", err);
      alert("Upload error: " + (err.message || "Unexpected error during upload"));
      if (successCount > 0) {
        fetchCurrentContents();
      }
    } finally {
      setUploadProgress(null);
      setUploadStatusText("");
      setIsAdding(false);
    }
  };

  // Download File
  const handleDownload = async (storageKey: string, fileName: string) => {
    try {
      const res = await getPresignedDownloadUrl(storageKey, fileName);
      if (res.success && res.downloadUrl) {
        const a = document.createElement("a");
        a.href = res.downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert("Download error: " + res.error);
      }
    } catch (err: any) {
      alert("Download failed: " + err.message);
    }
  };

  // Preview File / Secret
  const handleOpenPreview = async (item: VaultItem) => {
    setPreviewItem(item);
    setPreviewUrl(null);
    setPreviewDecryptedText(null);
    setPreviewTextContent(null);
    setIsPreviewMaximized(false);

    if (item.type === "document" && item.storage_key && item.file_name) {
      const res = await getPresignedViewUrl(item.storage_key, item.file_name);
      if (res.success && res.viewUrl) {
        setPreviewUrl(res.viewUrl);

        // Fetch raw text for text/code files
        const ext = item.file_name.split(".").pop()?.toLowerCase() || "";
        if (["txt", "json", "js", "ts", "jsx", "tsx", "py", "md", "html", "css", "csv", "log"].includes(ext)) {
          setIsLoadingText(true);
          try {
            const text = await fetch(res.viewUrl).then((r) => r.text());
            setPreviewTextContent(text);
          } catch (err) {
            console.error("Failed to load text preview:", err);
          } finally {
            setIsLoadingText(false);
          }
        }
      }
    } else if (item.secret && cryptoKey) {
      try {
        const text = await decryptText(item.secret, cryptoKey);
        setPreviewDecryptedText(text);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Rename
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameItem || !renameTitle.trim()) return;
    const res = await renameVaultItem(renameItem.id, renameTitle);
    if (res.success) {
      setRenameItem(null);
      fetchCurrentContents();
    } else {
      alert("Rename failed: " + res.error);
    }
  };

  // Move
  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveItem) return;
    const res = await moveVaultItem(moveItem.id, moveTargetFolderId);
    if (res.success) {
      setMoveItem(null);
      fetchCurrentContents();
    } else {
      alert("Move failed: " + res.error);
    }
  };

  // Copy
  const handleCopyItem = async (item: VaultItem) => {
    const res = await copyVaultItem(item.id, currentFolderId);
    if (res.success) {
      fetchCurrentContents();
    } else {
      alert("Copy failed: " + res.error);
    }
  };

  // Delete Permanently Direct
  const handleDeleteItemDirect = async (id: string) => {
    const res = await deleteVaultItem(id);
    if (res.success) {
      fetchCurrentContents();
    } else {
      alert("Delete failed: " + res.error);
    }
  };

  const handleDeleteItem = (item: VaultItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteConfirmItem(item);
  };

  // Decrypt secret inline
  const toggleInlineDecrypt = async (id: string, encryptedSecret: string) => {
    if (decryptedCache[id]) {
      const updated = { ...decryptedCache };
      delete updated[id];
      setDecryptedCache(updated);
    } else {
      if (!cryptoKey) return;
      try {
        const text = await decryptText(encryptedSecret, cryptoKey);
        setDecryptedCache({ ...decryptedCache, [id]: text });
      } catch (err) {
        alert("Decryption failed.");
      }
    }
  };

  // Copy secret to clipboard
  const handleCopySecret = async (id: string, encryptedSecret: string) => {
    if (!cryptoKey) return;
    try {
      const cleartext = decryptedCache[id] || (await decryptText(encryptedSecret, cryptoKey));
      await navigator.clipboard.writeText(cleartext);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      alert("Copy failed.");
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.file_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (filterType === "all") return true;

      const ext = item.file_name?.split(".").pop()?.toLowerCase() || "";

      if (filterType === "pdf") return item.type === "document" && ext === "pdf";
      if (filterType === "word") return item.type === "document" && ["doc", "docx", "rtf", "odt"].includes(ext);
      if (filterType === "pptx") return item.type === "document" && ["ppt", "pptx", "key", "odp"].includes(ext);
      if (filterType === "excel") return item.type === "document" && ["xls", "xlsx", "csv", "ods"].includes(ext);
      if (filterType === "image") return item.type === "document" && ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(ext);
      if (filterType === "code") return item.type === "document" && ["js", "ts", "json", "py", "html", "css", "sh", "jsx", "tsx"].includes(ext);
      if (filterType === "document") return item.type === "document";
      if (filterType === "password") return item.type === "password" || item.type === "credential";
      if (filterType === "note") return item.type === "note";

      return true;
    });
  }, [items, searchQuery, filterType]);

  // Compute count for each filter category
  const filterCounts = useMemo(() => {
    const counts = {
      all: items.length,
      pdf: 0,
      word: 0,
      pptx: 0,
      excel: 0,
      image: 0,
      code: 0,
      document: 0,
      password: 0,
      note: 0,
    };

    items.forEach((item) => {
      if (item.type === "document") {
        counts.document++;
        const ext = item.file_name?.split(".").pop()?.toLowerCase() || "";
        if (ext === "pdf") counts.pdf++;
        if (["doc", "docx", "rtf", "odt"].includes(ext)) counts.word++;
        if (["ppt", "pptx", "key", "odp"].includes(ext)) counts.pptx++;
        if (["xls", "xlsx", "csv", "ods"].includes(ext)) counts.excel++;
        if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(ext)) counts.image++;
        if (["js", "ts", "json", "py", "html", "css", "sh", "jsx", "tsx"].includes(ext)) counts.code++;
      } else if (item.type === "password" || item.type === "credential") {
        counts.password++;
      } else if (item.type === "note") {
        counts.note++;
      }
    });

    return counts;
  }, [items]);

  // Helpers for file icons & sizes
  const formatBytes = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return "0 B";
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileIcon = (item: VaultItem) => {
    if (item.type === "folder") return <Folder className="h-6 w-6 text-emerald-600 fill-emerald-100" />;
    if (item.type === "password") return <Key className="h-6 w-6 text-emerald-700" />;
    if (item.type === "note") return <FileText className="h-6 w-6 text-emerald-600" />;

    const ext = item.file_name?.split(".").pop()?.toLowerCase() || "";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
      return <FileImage className="h-6 w-6 text-emerald-600" />;
    }
    if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) {
      return <FileText className="h-6 w-6 text-emerald-700" />;
    }
    if (["js", "ts", "json", "html", "css", "py"].includes(ext)) {
      return <FileCode className="h-6 w-6 text-emerald-800" />;
    }
    if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) {
      return <FileArchive className="h-6 w-6 text-emerald-700" />;
    }
    return <File className="h-6 w-6 text-emerald-600" />;
  };

  // Lock Overlay Screen
  if (isLocked) {
    return (
      <div className={`flex min-h-screen theme-${uiTheme} flex-col items-center justify-center px-4 font-sans text-emerald-950 relative overflow-hidden transition-colors duration-300`}>
        {/* Subtle mint background glows */}
        <div className="absolute top-1/4 left-1/3 -z-10 h-96 w-96 rounded-full bg-emerald-200/40 blur-[130px]"></div>

        <div className="w-full max-w-md rounded-2xl glass-panel p-8 shadow-xl border border-emerald-200/80">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-300 mb-4 shadow-sm">
              <Lock className="h-8 w-8 animate-pulse text-emerald-800" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-emerald-950">
              Personal Cloud Vault
            </h1>
            <p className="mt-2 text-xs font-medium text-emerald-800/80">
              Zero-Knowledge Encrypted Document Storage
            </p>
          </div>

          {/* Theme Selector Pill on Lock Screen */}
          <div className="mb-6 flex justify-center">
            <div className="flex items-center gap-1 bg-black/5 p-1 rounded-xl border border-emerald-200/50">
              <button
                type="button"
                onClick={() => handleThemeChange("glass")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition ${
                  uiTheme === "glass"
                    ? "bg-white text-emerald-950 shadow-sm border border-emerald-300 font-extrabold"
                    : "text-emerald-800/80 hover:text-emerald-950"
                }`}
                title="Glassmorphism Theme"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>Glass</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange("neo")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition ${
                  uiTheme === "neo"
                    ? "bg-white text-emerald-950 shadow-sm border border-emerald-300 font-extrabold"
                    : "text-emerald-800/80 hover:text-emerald-950"
                }`}
                title="Neomorphism Theme"
              >
                <Box className="h-3.5 w-3.5 text-emerald-700" />
                <span>Neo</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange("clay")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition ${
                  uiTheme === "clay"
                    ? "bg-white text-emerald-950 shadow-sm border border-emerald-300 font-extrabold"
                    : "text-emerald-800/80 hover:text-emerald-950"
                }`}
                title="Claymorphism Theme"
              >
                <Layers className="h-3.5 w-3.5 text-emerald-600" />
                <span>Clay</span>
              </button>
            </div>
          </div>
          {showRecoveryOnLock ? (
            <form onSubmit={handleShamirUnlock} className="mt-6 space-y-4">
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 font-medium">
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <KeyRound className="h-4 w-4 text-amber-700" />
                  Shamir's Secret Sharing (SSS) Assembly
                </p>
                Paste your K threshold secret shares (one per line, e.g. <code className="bg-amber-100 px-1 rounded">1:a1b2c3...</code>) to reconstruct master key.
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-900 mb-1">
                  Emergency Secret Shares (Min K required)
                </label>
                <textarea
                  rows={4}
                  value={recoveryInputShares}
                  onChange={(e) => setRecoveryInputShares(e.target.value)}
                  placeholder="1:70617373...&#10;2:6b6579...&#10;3:64617461..."
                  className="w-full rounded-lg border border-emerald-200 bg-white p-3 text-xs font-mono text-emerald-950 placeholder-emerald-800/40 outline-none transition duration-200 focus:border-emerald-600"
                />
              </div>

              {recoveryError && (
                <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                  ⚠️ {recoveryError}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-800 transition"
                >
                  <Unlock className="h-4 w-4" />
                  Reconstruct & Unlock
                </button>
                <button
                  type="button"
                  onClick={() => setShowRecoveryOnLock(false)}
                  className="px-3 py-2.5 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleUnlock} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-900 mb-1">
                  Master Vault Password
                </label>
                <input
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  disabled={isUnlocking}
                  className="w-full rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-950 placeholder-emerald-800/40 outline-none transition duration-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              {unlockError && (
                <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                  ⚠️ {unlockError}
                </p>
              )}

              <button
                type="submit"
                disabled={isUnlocking}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 py-3 text-sm font-bold text-white shadow-md shadow-emerald-700/20 transition duration-200 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
              >
                {isUnlocking ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Verifying Security Key...
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4" />
                    Unlock Cloud Vault
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 flex flex-col gap-1.5 text-center">
            <button
              type="button"
              onClick={() => setShowRecoveryOnLock(!showRecoveryOnLock)}
              className="text-[11px] font-bold text-emerald-800/80 hover:text-emerald-950 hover:underline transition"
            >
              {showRecoveryOnLock ? "← Back to Password Unlock" : "🔑 Emergency Recovery (Shamir K-of-N Shares)"}
            </button>
            <button
              type="button"
              onClick={handleResetVaultPassword}
              className="text-[11px] font-semibold text-emerald-800/50 hover:text-emerald-950 hover:underline transition"
            >
              Reset Master Password Lock
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-screen overflow-hidden theme-${uiTheme} text-emerald-950 flex flex-col font-sans transition-colors duration-300`}>
      {/* Top Formal Navbar */}
      <header className="h-16 shrink-0 z-30 glass-header border-b border-emerald-100 bg-white/95 backdrop-blur-md shadow-xs flex items-center">
        <div className="mx-auto flex max-w-[1920px] w-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Hamburger Toggle */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-emerald-200 text-emerald-800 hover:bg-emerald-50 transition"
              title="Open Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
              <FolderOpen className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-emerald-950">
                PERSONAL VAULT
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-800">
                  Zero-Knowledge & PQC Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Research Security Suite Button */}
            <button
              type="button"
              onClick={() => setSecurityModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl shadow-xs transition"
              title="Open Advanced Security Suite"
            >
              <ShieldAlert className="h-4 w-4 text-emerald-700" />
              <span className="hidden md:inline">Research Security Suite</span>
            </button>

            {/* Theme Selector Widget */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-black/5 p-1 rounded-xl border border-emerald-200/60 shadow-2xs">
              <button
                type="button"
                onClick={() => handleThemeChange("glass")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  uiTheme === "glass"
                    ? "bg-white text-emerald-950 shadow-sm border border-emerald-300 font-extrabold"
                    : "text-emerald-800/70 hover:text-emerald-950"
                }`}
                title="Glassmorphism Theme"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Glass</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange("neo")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  uiTheme === "neo"
                    ? "bg-white text-emerald-950 shadow-sm border border-emerald-300 font-extrabold"
                    : "text-emerald-800/70 hover:text-emerald-950"
                }`}
                title="Neomorphism Theme"
              >
                <Box className="h-3.5 w-3.5 text-emerald-700" />
                <span className="hidden sm:inline">Neo</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange("clay")}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  uiTheme === "clay"
                    ? "bg-white text-emerald-950 shadow-sm border border-emerald-300 font-extrabold"
                    : "text-emerald-800/70 hover:text-emerald-950"
                }`}
                title="Claymorphism Theme"
              >
                <Layers className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Clay</span>
              </button>
            </div>

            <button
              onClick={fetchCurrentContents}
              disabled={isPending}
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 transition"
              title="Refresh Folder"
            >
              <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isPending ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleLock}
              className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-rose-50 border border-rose-200 px-2.5 sm:px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lock Vault</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Slide-over Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-emerald-950/40 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          ></div>
          <aside className="relative z-50 w-72 max-w-[85vw] bg-white h-full p-4 space-y-6 overflow-y-auto shadow-2xl border-r border-emerald-100">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-emerald-700" />
                <span className="font-bold text-sm text-emerald-950">Navigation Menu</span>
              </div>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="text-emerald-700 p-1 hover:text-emerald-950"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-900/60 px-3 mb-1">
                File Categories
              </p>
              <button
                onClick={() => {
                  setFilterType("all");
                  setMobileSidebarOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  filterType === "all" ? "bg-emerald-800 text-white shadow-sm" : "text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  <span>All Contents</span>
                </div>
                <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">{filterCounts.all}</span>
              </button>

              <button
                onClick={() => {
                  setFilterType("pdf");
                  setMobileSidebarOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  filterType === "pdf" ? "bg-emerald-800 text-white shadow-sm" : "text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-700" />
                  <span>PDF Documents</span>
                </div>
                <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">{filterCounts.pdf}</span>
              </button>

              <button
                onClick={() => {
                  setFilterType("word");
                  setMobileSidebarOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  filterType === "word" ? "bg-emerald-800 text-white shadow-sm" : "text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <span>Word Files</span>
                </div>
                <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">{filterCounts.word}</span>
              </button>

              <button
                onClick={() => {
                  setFilterType("pptx");
                  setMobileSidebarOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  filterType === "pptx" ? "bg-emerald-800 text-white shadow-sm" : "text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4 text-emerald-600" />
                  <span>PowerPoint</span>
                </div>
                <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">{filterCounts.pptx}</span>
              </button>

              <button
                onClick={() => {
                  setFilterType("excel");
                  setMobileSidebarOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  filterType === "excel" ? "bg-emerald-800 text-white shadow-sm" : "text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Grid className="h-4 w-4 text-emerald-600" />
                  <span>Excel Sheets</span>
                </div>
                <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">{filterCounts.excel}</span>
              </button>

              <button
                onClick={() => {
                  setFilterType("image");
                  setMobileSidebarOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  filterType === "image" ? "bg-emerald-800 text-white shadow-sm" : "text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileImage className="h-4 w-4 text-emerald-600" />
                  <span>Images & Photos</span>
                </div>
                <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">{filterCounts.image}</span>
              </button>

              <button
                onClick={() => {
                  setFilterType("code");
                  setMobileSidebarOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  filterType === "code" ? "bg-emerald-800 text-white shadow-sm" : "text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-emerald-700" />
                  <span>Code & Scripts</span>
                </div>
                <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">{filterCounts.code}</span>
              </button>

              <button
                onClick={() => {
                  setFilterType("password");
                  setMobileSidebarOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  filterType === "password" ? "bg-emerald-800 text-white shadow-sm" : "text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-emerald-700" />
                  <span>Logins & Passwords</span>
                </div>
                <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">{filterCounts.password}</span>
              </button>

              <button
                onClick={() => {
                  setFilterType("note");
                  setMobileSidebarOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  filterType === "note" ? "bg-emerald-800 text-white shadow-sm" : "text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <span>Secure Notes</span>
                </div>
                <span className="text-[10px] opacity-80 bg-black/10 px-1.5 py-0.5 rounded">{filterCounts.note}</span>
              </button>
            </div>

            <div className="space-y-2 pt-2 border-t border-emerald-100">
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-900/60 px-3">
                Folder Navigation
              </p>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setCurrentFolderId(null);
                    setMobileSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition ${
                    currentFolderId === null ? "bg-emerald-100 text-emerald-950 font-bold" : "text-emerald-900 hover:bg-emerald-50"
                  }`}
                >
                  <Home className="h-3.5 w-3.5 text-emerald-700" />
                  Root Vault
                </button>
                {allFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setCurrentFolderId(folder.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-6 py-2 text-xs font-bold rounded-lg truncate transition ${
                      currentFolderId === folder.id ? "bg-emerald-100 text-emerald-950 font-bold" : "text-emerald-800 hover:bg-emerald-50"
                    }`}
                  >
                    <Folder className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{folder.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Workspace Split Layout */}
      <div className="flex-1 min-h-0 flex max-w-[1920px] mx-auto w-full px-4 sm:px-6 py-4 gap-5 overflow-hidden">
        {/* Left Sidebar Navigation (Desktop) - Futuristic Glass & Sci-Fi HUD */}
        <FuturisticSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          filterType={filterType}
          setFilterType={setFilterType}
          filterCounts={filterCounts}
          currentFolderId={currentFolderId}
          setCurrentFolderId={setCurrentFolderId}
          allFolders={allFolders}
        />

        {/* Main Explorer Canvas */}
        <main className="flex-1 flex flex-col space-y-4 min-w-0 h-full overflow-y-auto pr-1">
          {/* Top Explorer Actions Toolbar */}
          <div className="rounded-xl glass-panel p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between border border-emerald-100">
            {/* Section Header or Breadcrumb Path Bar */}
            {activeSection === "vault" ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-900 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  onClick={() => setCurrentFolderId(null)}
                  onDragOver={(e) => handleDragOverFolder(e, null)}
                  onDrop={(e) => handleDropOnFolder(e, null)}
                  className={`flex items-center gap-1 hover:text-emerald-700 font-bold transition shrink-0 px-2 py-1 rounded-lg ${
                    dragOverFolderId === null ? "bg-emerald-200 border border-emerald-400" : ""
                  }`}
                >
                  <Home className="h-3.5 w-3.5 text-emerald-700" />
                  Vault Root
                </button>
                {breadcrumbs.map((crumb) => (
                  <div key={crumb.id} className="flex items-center gap-1 shrink-0">
                    <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />
                    <button
                      onClick={() => setCurrentFolderId(crumb.id)}
                      onDragOver={(e) => handleDragOverFolder(e, crumb.id)}
                      onDrop={(e) => handleDropOnFolder(e, crumb.id)}
                      className={`hover:text-emerald-700 transition px-2 py-1 rounded-lg ${
                        currentFolderId === crumb.id ? "text-emerald-950 font-extrabold" : "font-semibold"
                      } ${dragOverFolderId === crumb.id ? "bg-emerald-200 border border-emerald-400" : ""}`}
                    >
                      {crumb.title}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-950">
                {activeSection === "favorites" && (
                  <>
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> Starred Favorites
                  </>
                )}
                {activeSection === "archive" && (
                  <>
                    <Archive className="h-4 w-4 text-sky-600" /> Document Archive
                  </>
                )}
                {activeSection === "trash" && (
                  <>
                    <Trash2 className="h-4 w-4 text-rose-600" /> Trash Bin
                  </>
                )}
              </div>
            )}

            {/* Action Buttons & View Toggles */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 w-full sm:w-auto justify-start sm:justify-end">
              {activeSection === "trash" && (
                <button
                  onClick={handleEmptyTrash}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-700 text-white hover:bg-rose-800 text-xs sm:text-sm font-extrabold shadow-xs transition"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Empty Trash Bin</span>
                </button>
              )}

              {activeSection === "vault" && (
                <>
                  <button
                    onClick={() => setNewFolderModalOpen(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100 text-xs sm:text-sm font-extrabold transition"
                  >
                    <FolderPlus className="h-4 w-4 text-emerald-700" />
                    <span>Folder</span>
                  </button>

                  <button
                    onClick={() => {
                      setRecordTab("document");
                      setAddRecordModalOpen(true);
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 text-xs sm:text-sm font-extrabold shadow-sm shadow-emerald-700/20 transition"
                  >
                    <CloudUpload className="h-4 w-4" />
                    <span>Upload</span>
                  </button>

                  <button
                    onClick={() => {
                      setRecordTab("password");
                      setAddRecordModalOpen(true);
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-950 text-white hover:bg-emerald-900 text-xs sm:text-sm font-extrabold transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Record</span>
                  </button>
                </>
              )}

              <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-xl p-0.5 ml-auto sm:ml-2">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === "grid" ? "bg-white text-emerald-950 shadow-xs" : "text-emerald-700 hover:text-emerald-950"
                  }`}
                  title="Grid View"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === "list" ? "bg-white text-emerald-950 shadow-xs" : "text-emerald-700 hover:text-emerald-950"
                  }`}
                  title="List View"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Search bar & info row */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 items-start sm:items-center justify-between px-1">
            <p className="text-xs sm:text-sm font-bold text-emerald-900">
              Showing <span className="text-emerald-950 font-black">{filteredItems.length}</span> items in directory
            </p>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-2.5 sm:top-2.5 h-4 w-4 text-emerald-600" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-emerald-200 bg-white pl-9 pr-3 py-2 text-xs sm:text-sm font-medium text-emerald-950 placeholder-emerald-800/50 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs"
              />
            </div>
          </div>

          {/* Explorer Content Canvas */}
          {filteredItems.length === 0 ? (
            <div className="flex-1 rounded-xl border border-dashed border-emerald-200 bg-white/60 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <FolderOpen className="h-12 w-12 text-emerald-400 mb-3" />
              <p className="text-emerald-900 font-bold text-sm">
                {activeSection === "trash" ? "Trash bin is empty" : activeSection === "favorites" ? "No starred favorites" : activeSection === "archive" ? "No archived documents" : "This folder is empty"}
              </p>
              <p className="text-xs text-emerald-800/70 mt-1 max-w-sm">
                {activeSection === "trash" ? "Items moved to trash will appear here." : "Drag and drop files, star items, or upload documents to get started!"}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View Layout - Modern auto-fill minmax grid */
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4 sm:gap-5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragOver={(e) => item.type === "folder" && handleDragOverFolder(e, item.id)}
                  onDrop={(e) => item.type === "folder" && handleDropOnFolder(e, item.id)}
                  className={`group relative rounded-xl glass-panel glass-panel-hover p-4 flex flex-col justify-between cursor-pointer border bg-white transition ${
                    dragOverFolderId === item.id ? "border-emerald-500 bg-emerald-100/60 ring-2 ring-emerald-500" : "border-emerald-100/80"
                  }`}
                  onClick={() => {
                    if (item.type === "folder") {
                      setCurrentFolderId(item.id);
                    } else {
                      handleOpenPreview(item);
                    }
                  }}
                >
                  {/* Top Item Row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleToggleFavorite(item, e)}
                        className="p-1 text-emerald-300 hover:text-amber-400 transition"
                        title={item.is_favorite ? "Unstar" : "Star Favorite"}
                      >
                        <Star className={`h-4 w-4 ${item.is_favorite ? "fill-amber-400 text-amber-500" : "text-emerald-300 hover:text-amber-400"}`} />
                      </button>
                      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100">
                        {getFileIcon(item)}
                      </div>
                    </div>

                    {/* Action Dropdown Toggle */}
                    <div
                      className="relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setActionMenuOpenId(actionMenuOpenId === item.id ? null : item.id)
                        }
                        className="p-1 text-emerald-700 hover:text-emerald-950 rounded-md hover:bg-emerald-50 transition"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {actionMenuOpenId === item.id && (
                        <div className="absolute right-0 top-6 z-20 w-44 rounded-lg border border-emerald-200 bg-white py-1 shadow-xl text-xs">
                          {item.type === "document" && item.storage_key && item.file_name && (
                            <button
                              onClick={() => {
                                setActionMenuOpenId(null);
                                handleDownload(item.storage_key!, item.file_name!);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-emerald-900 hover:bg-emerald-100 font-medium transition"
                            >
                              <Download className="h-3.5 w-3.5 text-emerald-700" />
                              Download
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              setActionMenuOpenId(null);
                              handleToggleFavorite(item, e);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-emerald-900 hover:bg-emerald-100 font-medium transition"
                          >
                            <Star className={`h-3.5 w-3.5 ${item.is_favorite ? "fill-amber-400 text-amber-500" : "text-emerald-700"}`} />
                            {item.is_favorite ? "Remove Favorite" : "Add Favorite"}
                          </button>
                          <button
                            onClick={() => {
                              setActionMenuOpenId(null);
                              setRenameItem(item);
                              setRenameTitle(item.title);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-emerald-900 hover:bg-emerald-100 font-medium transition"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-emerald-700" />
                            Rename
                          </button>
                          <button
                            onClick={() => {
                              setActionMenuOpenId(null);
                              handleCopyItem(item);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-emerald-900 hover:bg-emerald-100 font-medium transition"
                          >
                            <Copy className="h-3.5 w-3.5 text-emerald-700" />
                            Duplicate
                          </button>
                          <button
                            onClick={() => {
                              setActionMenuOpenId(null);
                              setMoveItem(item);
                              setMoveTargetFolderId(currentFolderId);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-emerald-900 hover:bg-emerald-100 font-medium transition"
                          >
                            <Move className="h-3.5 w-3.5 text-emerald-700" />
                            Move To...
                          </button>
                          {activeSection === "trash" ? (
                            <>
                              <button
                                onClick={(e) => {
                                  setActionMenuOpenId(null);
                                  handleSetStatus(item, "active", e);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-emerald-800 hover:bg-emerald-50 font-medium transition"
                              >
                                <RotateCcw className="h-3.5 w-3.5 text-emerald-600" />
                                Restore Item
                              </button>
                              <button
                                onClick={(e) => {
                                  setActionMenuOpenId(null);
                                  handleDeleteItem(item, e);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-rose-700 hover:bg-rose-50 font-medium transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete Permanently
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  setActionMenuOpenId(null);
                                  handleSetStatus(item, item.status === "archived" ? "active" : "archived", e);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-emerald-900 hover:bg-emerald-100 font-medium transition"
                              >
                                <Archive className="h-3.5 w-3.5 text-sky-600" />
                                {item.status === "archived" ? "Unarchive" : "Archive"}
                              </button>
                              <button
                                onClick={(e) => {
                                  setActionMenuOpenId(null);
                                  handleSetStatus(item, "trash", e);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-rose-700 hover:bg-rose-50 font-medium transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Move to Trash
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Metadata */}
                  <div className="space-y-1">
                    <h3 className="font-black text-base text-emerald-950 truncate" title={item.title}>
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm font-bold text-emerald-800/90 truncate">
                      {item.type === "folder" && "Folder"}
                      {item.type === "document" && formatBytes(item.file_size)}
                      {item.type === "password" && (item.username || "Password")}
                      {item.type === "note" && "Encrypted Note"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List View Layout */
            <div className="rounded-xl glass-panel border border-emerald-100 bg-white overflow-x-auto shadow-sm">
              <table className="w-full min-w-[480px] text-left text-xs text-emerald-950">
                <thead className="border-b border-emerald-100 bg-emerald-50 text-emerald-900 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragOver={(e) => item.type === "folder" && handleDragOverFolder(e, item.id)}
                      onDrop={(e) => item.type === "folder" && handleDropOnFolder(e, item.id)}
                      onClick={() => {
                        if (item.type === "folder") {
                          setCurrentFolderId(item.id);
                        } else {
                          handleOpenPreview(item);
                        }
                      }}
                      className={`hover:bg-emerald-50/60 cursor-pointer transition ${
                        dragOverFolderId === item.id ? "bg-emerald-100/80" : ""
                      }`}
                    >
                      <td className="px-4 py-3 flex items-center gap-2.5 font-bold text-emerald-950">
                        <button
                          onClick={(e) => handleToggleFavorite(item, e)}
                          className="p-1 text-emerald-300 hover:text-amber-400 transition"
                          title={item.is_favorite ? "Unstar" : "Star Favorite"}
                        >
                          <Star className={`h-3.5 w-3.5 ${item.is_favorite ? "fill-amber-400 text-amber-500" : "text-emerald-300 hover:text-amber-400"}`} />
                        </button>
                        {getFileIcon(item)}
                        <span className="truncate max-w-xs">{item.title}</span>
                      </td>
                      <td className="px-4 py-3 text-emerald-800 uppercase text-[10px] font-bold">
                        {item.type}
                      </td>
                      <td className="px-4 py-3 text-emerald-800 font-medium">
                        {item.type === "document" ? formatBytes(item.file_size) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {item.type === "document" && item.storage_key && item.file_name && (
                            <button
                              onClick={() => handleDownload(item.storage_key!, item.file_name!)}
                              className="p-1.5 text-emerald-700 hover:text-emerald-950 transition"
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setRenameItem(item);
                              setRenameTitle(item.title);
                            }}
                            className="p-1.5 text-emerald-700 hover:text-emerald-950 transition"
                            title="Rename"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setMoveItem(item);
                              setMoveTargetFolderId(currentFolderId);
                            }}
                            className="p-1.5 text-emerald-700 hover:text-emerald-950 transition"
                            title="Move"
                          >
                            <Move className="h-4 w-4" />
                          </button>
                          {activeSection === "trash" ? (
                            <>
                              <button
                                onClick={(e) => handleSetStatus(item, "active", e)}
                                className="p-1.5 text-emerald-700 hover:text-emerald-950 transition"
                                title="Restore"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteItem(item, e)}
                                className="p-1.5 text-rose-600 hover:text-rose-800 transition"
                                title="Delete Permanently"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => handleSetStatus(item, "trash", e)}
                              className="p-1.5 text-rose-600 hover:text-rose-800 transition"
                              title="Move to Trash"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* --- MODALS --- */}

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/40 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl glass-panel p-6 space-y-4 border border-rose-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <h3 className="text-base font-bold text-rose-950 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-600" />
                {activeSection === "trash" ? "Delete Permanently" : "Move to Trash"}
              </h3>
              <button onClick={() => setDeleteConfirmItem(null)} className="text-emerald-700 hover:text-emerald-950">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-2 text-xs text-emerald-900">
              <p className="font-semibold text-sm text-emerald-950">
                Are you sure you want to {activeSection === "trash" ? "permanently delete" : "move"} <span className="font-extrabold text-rose-700">"{deleteConfirmItem.title}"</span>?
              </p>
              <p className="text-emerald-800/80">
                {activeSection === "trash"
                  ? "This action cannot be undone. Encrypted data and Cloudflare R2 files will be permanently purged."
                  : "Item will be moved to the Trash bin where it can be restored or purged later."}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="rounded-lg border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const item = deleteConfirmItem;
                  setDeleteConfirmItem(null);
                  if (activeSection === "trash") {
                    await handleDeleteItemDirect(item.id);
                  } else {
                    await handleSetStatusDirect(item, "trash");
                  }
                }}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition"
              >
                {activeSection === "trash" ? "Delete Permanently" : "Move to Trash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty Trash Confirmation Modal */}
      {emptyTrashConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/40 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl glass-panel p-6 space-y-4 border border-rose-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <h3 className="text-base font-bold text-rose-950 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-rose-600" />
                Empty Trash Bin?
              </h3>
              <button onClick={() => setEmptyTrashConfirmOpen(false)} className="text-emerald-700 hover:text-emerald-950">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-2 text-xs text-emerald-900">
              <p className="font-semibold text-sm text-emerald-950">
                Are you sure you want to permanently purge all items in the Trash bin?
              </p>
              <p className="text-rose-700 font-medium bg-rose-50 p-2 rounded-lg border border-rose-100">
                ⚠️ All encrypted records, notes, passwords, and Cloudflare R2 files will be permanently destroyed. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-100">
              <button
                type="button"
                onClick={() => setEmptyTrashConfirmOpen(false)}
                className="rounded-lg border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setEmptyTrashConfirmOpen(false);
                  await handleEmptyTrashDirect();
                }}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                Empty Trash Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. New Folder Modal */}
      {newFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl glass-panel p-6 space-y-4 border border-emerald-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <h3 className="text-base font-bold text-emerald-950 flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-emerald-600" />
                Create New Folder
              </h3>
              <button onClick={() => setNewFolderModalOpen(false)} className="text-emerald-700 hover:text-emerald-950">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">Folder Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Financial Documents"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 outline-none focus:border-emerald-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewFolderModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 shadow-sm transition"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Record / Upload Document Modal */}
      {addRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl glass-panel p-6 space-y-4 border border-emerald-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <h3 className="text-base font-bold text-emerald-950">Add to Current Folder</h3>
              <button onClick={() => setAddRecordModalOpen(false)} className="text-emerald-700 hover:text-emerald-950">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Selector tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-emerald-50 border border-emerald-200 rounded-lg">
              <button
                type="button"
                onClick={() => setRecordTab("document")}
                className={`py-1.5 text-xs font-bold rounded-md transition ${
                  recordTab === "document" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-800"
                }`}
              >
                Document
              </button>
              <button
                type="button"
                onClick={() => setRecordTab("password")}
                className={`py-1.5 text-xs font-bold rounded-md transition ${
                  recordTab === "password" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-800"
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setRecordTab("note")}
                className={`py-1.5 text-xs font-bold rounded-md transition ${
                  recordTab === "note" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-800"
                }`}
              >
                Note
              </button>
            </div>

            {recordTab === "document" ? (
              <form onSubmit={handleAddDocument} className="space-y-4">
                {selectedFiles.length <= 1 && (
                  <div>
                    <label className="block text-xs font-bold text-emerald-900 mb-1">Title (Optional)</label>
                    <input
                      type="text"
                      placeholder={selectedFile ? selectedFile.name : "e.g. Tax Statement 2026"}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 outline-none focus:border-emerald-600"
                    />
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-emerald-900">
                      Select Files {selectedFiles.length > 0 && `(${selectedFiles.length})`}
                    </label>
                    {selectedFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setSelectedFiles([]); setSelectedFile(null); }}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-800"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    multiple
                    required={selectedFiles.length === 0}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setSelectedFiles(files);
                      setSelectedFile(files[0] || null);
                    }}
                    className="w-full rounded-lg border border-emerald-200 bg-white p-2 text-xs text-emerald-900 font-medium cursor-pointer file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 transition"
                  />
                </div>

                {/* Selected Files Preview List */}
                {selectedFiles.length > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-emerald-50/70 border border-emerald-200/80 rounded-lg">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-white p-1.5 rounded border border-emerald-100">
                        <span className="truncate max-w-[220px] font-medium text-emerald-950" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {uploadProgress !== null && (
                  <div className="space-y-1.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="flex justify-between text-xs font-bold text-emerald-900">
                      <span className="truncate max-w-[240px]">{uploadStatusText || "Uploading files..."}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-150"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isAdding || (selectedFiles.length === 0 && !selectedFile)}
                  className="w-full py-2.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition shadow-sm disabled:opacity-50"
                >
                  {isAdding
                    ? "Uploading..."
                    : selectedFiles.length > 1
                    ? `Upload ${selectedFiles.length} Files`
                    : "Upload File"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAddCredential} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Work Email Password"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 outline-none focus:border-emerald-600"
                  />
                </div>
                {recordTab === "password" && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-emerald-900 mb-1">Username</label>
                      <input
                        type="text"
                        placeholder="user@mail.com"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-emerald-900 mb-1">Password</label>
                      <input
                        type="text"
                        required
                        placeholder="••••••••"
                        value={secretPassword}
                        onChange={(e) => setSecretPassword(e.target.value)}
                        className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 outline-none focus:border-emerald-600"
                      />
                    </div>
                  </>
                )}
                {recordTab === "note" && (
                  <div>
                    <label className="block text-xs font-bold text-emerald-900 mb-1">Encrypted Note</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Sensitive text..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="w-full rounded-lg border border-emerald-200 bg-white p-3 text-sm text-emerald-950 outline-none focus:border-emerald-600 resize-none"
                    ></textarea>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isAdding}
                  className="w-full py-2.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition shadow-sm"
                >
                  Save Encrypted Record
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. Document Preview Modal */}
      {previewItem && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/50 backdrop-blur-md ${isPreviewMaximized ? "p-0" : "p-2 sm:p-4"}`}>
          <div className={`w-full flex flex-col space-y-3 sm:space-y-4 glass-panel border border-emerald-200 bg-white shadow-2xl transition-all duration-200 ${
            isPreviewMaximized
              ? "h-screen w-screen max-w-none max-h-none rounded-none p-4 sm:p-6 bg-white"
              : "max-w-4xl max-h-[95vh] sm:max-h-[90vh] rounded-xl p-4 sm:p-6"
          }`}>
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                {getFileIcon(previewItem)}
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-emerald-950 truncate">{previewItem.title}</h3>
                  <p className="text-[10px] sm:text-xs text-emerald-800/70 font-semibold uppercase">{previewItem.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition"
                    title="Open in new mobile tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Open Tab</span>
                  </a>
                )}
                <button
                  onClick={() => setIsPreviewMaximized(!isPreviewMaximized)}
                  className="p-1.5 text-emerald-700 hover:text-emerald-950 rounded-lg hover:bg-emerald-50 transition"
                  title={isPreviewMaximized ? "Restore Size" : "Maximize Screen"}
                >
                  {isPreviewMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button onClick={() => setPreviewItem(null)} className="p-1.5 text-emerald-700 hover:text-emerald-950">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Preview Body */}
            <div className={`flex-1 overflow-y-auto bg-emerald-50/50 rounded-lg border border-emerald-100 p-2 sm:p-4 flex items-center justify-center ${
              isPreviewMaximized ? "h-[calc(100vh-140px)] max-h-none" : "min-h-[260px]"
            }`}>
              {previewItem.type === "document" ? (
                previewUrl ? (
                  previewItem.file_name?.match(/\.(doc|docx|ppt|pptx|xls|xlsx)$/i) ? (
                    <div className="w-full h-full flex flex-col items-center">
                      <div className="w-full flex items-center justify-between mb-2 px-1 text-[11px] text-emerald-800 font-semibold">
                        <span>Office Viewer Engine</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setOfficeViewerEngine("office")}
                            className={`px-2 py-0.5 rounded transition ${
                              officeViewerEngine === "office" ? "bg-emerald-800 text-white font-bold" : "hover:bg-emerald-100"
                            }`}
                          >
                            MS Office
                          </button>
                          <button
                            onClick={() => setOfficeViewerEngine("google")}
                            className={`px-2 py-0.5 rounded transition ${
                              officeViewerEngine === "google" ? "bg-emerald-800 text-white font-bold" : "hover:bg-emerald-100"
                            }`}
                          >
                            Google Viewer
                          </button>
                        </div>
                      </div>
                      <iframe
                        src={
                          officeViewerEngine === "office"
                            ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`
                            : `https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true`
                        }
                        className={`w-full rounded border border-emerald-200 bg-white ${
                          isPreviewMaximized ? "h-[calc(100vh-210px)]" : "h-[340px] sm:h-[500px]"
                        }`}
                        title="Office Document Preview"
                      ></iframe>
                    </div>
                  ) : previewItem.file_name?.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i) ? (
                    <img
                      src={previewUrl}
                      alt={previewItem.title}
                      className={`object-contain rounded shadow-md ${
                        isPreviewMaximized ? "max-h-[calc(100vh-180px)]" : "max-h-[380px] sm:max-h-[500px]"
                      }`}
                    />
                  ) : previewItem.file_name?.match(/\.pdf$/i) ? (
                    <div className="w-full h-full flex flex-col items-center">
                      <div className="w-full flex items-center justify-between mb-2 px-1 text-[11px] text-emerald-800 font-semibold">
                        <span>PDF Viewer Engine</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPdfViewerEngine("google")}
                            className={`px-2 py-0.5 rounded transition ${
                              pdfViewerEngine === "google" ? "bg-emerald-800 text-white font-bold" : "hover:bg-emerald-100"
                            }`}
                          >
                            Google PDF (Mobile)
                          </button>
                          <button
                            onClick={() => setPdfViewerEngine("native")}
                            className={`px-2 py-0.5 rounded transition ${
                              pdfViewerEngine === "native" ? "bg-emerald-800 text-white font-bold" : "hover:bg-emerald-100"
                            }`}
                          >
                            Native PDF
                          </button>
                        </div>
                      </div>
                      <iframe
                        src={
                          pdfViewerEngine === "google"
                            ? `https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true`
                            : `${previewUrl}#toolbar=1`
                        }
                        className={`w-full rounded border border-emerald-200 bg-white ${
                          isPreviewMaximized ? "h-[calc(100vh-210px)]" : "h-[340px] sm:h-[500px]"
                        }`}
                        title="PDF Preview"
                      ></iframe>
                    </div>
                  ) : previewItem.file_name?.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                    <video
                      controls
                      playsInline
                      src={previewUrl}
                      className={`w-full rounded ${
                        isPreviewMaximized ? "max-h-[calc(100vh-180px)]" : "max-h-[480px]"
                      }`}
                    />
                  ) : previewItem.file_name?.match(/\.(mp3|wav|aac|m4a)$/i) ? (
                    <div className="w-full px-4 sm:px-6 py-6 sm:py-8">
                      <audio controls src={previewUrl} className="w-full" />
                    </div>
                  ) : previewItem.file_name?.match(/\.(txt|json|js|ts|jsx|tsx|py|md|html|css|csv|log)$/i) || (previewItem as VaultItem).type === "note" ? (
                    isLoadingText ? (
                      <RefreshCw className="h-6 w-6 animate-spin text-emerald-700" />
                    ) : (
                      <DeveloperEditor
                        item={previewItem}
                        content={previewTextContent || previewItem.notes || "No content"}
                        vaultItems={items}
                        onNavigateToItem={(navItem) => handleOpenPreview(navItem)}
                        readOnly={true}
                      />
                    )
                  ) : (
                    <div className="text-center space-y-3 p-6">
                      <File className="h-16 w-16 text-emerald-600 mx-auto" />
                      <p className="text-sm font-bold text-emerald-950">Direct preview not available for this binary format.</p>
                      <p className="text-xs text-emerald-800/80">You can download the file to view it on your device.</p>
                      <button
                        onClick={() => handleDownload(previewItem.storage_key!, previewItem.file_name!)}
                        className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-2 hover:bg-emerald-800 transition shadow-xs"
                      >
                        <Download className="h-4 w-4" /> Download File ({formatBytes(previewItem.file_size)})
                      </button>
                    </div>
                  )
                ) : (
                  <RefreshCw className="h-6 w-6 animate-spin text-emerald-700" />
                )
              ) : (
                <div className="w-full space-y-4 text-left p-2">
                  {previewItem.type === "password" && (
                    <div>
                      <p className="text-xs font-bold text-emerald-900 uppercase">Username / Email</p>
                      <p className="text-sm font-mono text-emerald-950 font-bold mt-1">{previewItem.username || "—"}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-emerald-900 uppercase">Cleartext Secret</p>
                    <div className="mt-1 flex items-center justify-between bg-white p-3 rounded-lg border border-emerald-200 font-mono text-sm text-emerald-800">
                      <span>{previewDecryptedText || "Decrypting..."}</span>
                      {previewDecryptedText && (
                        <button
                          onClick={() => handleCopySecret(previewItem.id, previewItem.secret!)}
                          className="text-emerald-700 hover:text-emerald-950"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-emerald-100 pt-3">
              {previewItem.type === "document" && previewItem.storage_key && (
                <button
                  onClick={() => handleDownload(previewItem.storage_key!, previewItem.file_name!)}
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 hover:bg-emerald-800 transition shadow-xs"
                >
                  <Download className="h-4 w-4" />
                  Download File
                </button>
              )}
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 rounded-lg bg-emerald-100 text-emerald-950 font-bold text-xs hover:bg-emerald-200 transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Rename Modal */}
      {renameItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl glass-panel p-6 space-y-4 border border-emerald-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <h3 className="text-base font-bold text-emerald-950">Rename Item</h3>
              <button onClick={() => setRenameItem(null)} className="text-emerald-700 hover:text-emerald-950">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">New Title / Name</label>
                <input
                  type="text"
                  required
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 outline-none focus:border-emerald-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenameItem(null)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition shadow-xs"
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Move Modal */}
      {moveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl glass-panel p-6 space-y-4 border border-emerald-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <h3 className="text-base font-bold text-emerald-950 flex items-center gap-2">
                <Move className="h-4 w-4 text-emerald-700" /> Move "{moveItem.title}"
              </h3>
              <button onClick={() => setMoveItem(null)} className="text-emerald-700 hover:text-emerald-950">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleMoveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-2">Target Folder</label>
                <div className="space-y-1 max-h-48 overflow-y-auto border border-emerald-200 rounded-lg p-2 bg-emerald-50/50">
                  <button
                    type="button"
                    onClick={() => setMoveTargetFolderId(null)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition ${
                      moveTargetFolderId === null ? "bg-emerald-700 text-white" : "text-emerald-900 hover:bg-emerald-100"
                    }`}
                  >
                    <Home className="h-3.5 w-3.5 text-emerald-600" /> Root Vault
                  </button>
                  {allFolders
                    .filter((f) => f.id !== moveItem.id)
                    .map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setMoveTargetFolderId(f.id)}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition ${
                          moveTargetFolderId === f.id ? "bg-emerald-700 text-white" : "text-emerald-900 hover:bg-emerald-100"
                        }`}
                      >
                        <Folder className="h-3.5 w-3.5 text-emerald-600" /> {f.title}
                      </button>
                    ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMoveItem(null)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition shadow-xs"
                >
                  Move Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 6. Advanced Research Security Suite Modal */}
      {securityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl glass-panel border border-emerald-200/80 bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-100 bg-emerald-950 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-800/80 border border-emerald-600">
                  <ShieldAlert className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">
                    ADVANCED RESEARCH SECURITY SUITE
                  </h3>
                  <p className="text-[10px] text-emerald-300 uppercase tracking-widest font-mono">
                    Zero-Knowledge • Post-Quantum • Merkle Hash Chain • ZK-SNARKs
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSecurityModalOpen(false)}
                className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center gap-1 px-4 py-2 bg-emerald-50/80 border-b border-emerald-200/60 overflow-x-auto text-xs font-bold">
              <button
                onClick={() => setSecurityTab("sss")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  securityTab === "sss" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-900 hover:bg-emerald-100"
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" /> Shamir SSS
              </button>
              <button
                onClick={() => setSecurityTab("pqc")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  securityTab === "pqc" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-900 hover:bg-emerald-100"
                }`}
              >
                <Cpu className="h-3.5 w-3.5" /> PQC Kyber
              </button>
              <button
                onClick={() => {
                  setSecurityTab("audit");
                  handleFetchAuditLogs();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  securityTab === "audit" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-900 hover:bg-emerald-100"
                }`}
              >
                <GitCommit className="h-3.5 w-3.5" /> Merkle Audit Log
              </button>
              <button
                onClick={() => setSecurityTab("zkp")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  securityTab === "zkp" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-900 hover:bg-emerald-100"
                }`}
              >
                <FileCheck className="h-3.5 w-3.5" /> ZK Proofs
              </button>
              <button
                onClick={() => setSecurityTab("webauthn")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  securityTab === "webauthn" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-900 hover:bg-emerald-100"
                }`}
              >
                <Fingerprint className="h-3.5 w-3.5" /> Hardware Keys
              </button>
              <button
                onClick={() => {
                  setSecurityTab("ids");
                  handleRunAnomalyAudit();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  securityTab === "ids" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-900 hover:bg-emerald-100"
                }`}
              >
                <Activity className="h-3.5 w-3.5" /> Anomaly IDS
              </button>
              <button
                onClick={() => setSecurityTab("sharing")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  securityTab === "sharing" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-900 hover:bg-emerald-100"
                }`}
              >
                <Share2 className="h-3.5 w-3.5" /> E2EE Sharing
              </button>
              <button
                onClick={() => setSecurityTab("breach")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  securityTab === "breach" ? "bg-emerald-700 text-white shadow-xs" : "text-emerald-900 hover:bg-emerald-100"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> HIBP Breach Check
              </button>
            </div>

            {/* Modal Body Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-emerald-950">
              {/* TAB 1: SHAMIR'S SECRET SHARING */}
              {securityTab === "sss" && (
                <div className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs leading-relaxed text-emerald-900">
                    <h4 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2 mb-1">
                      <KeyRound className="h-4 w-4 text-emerald-700" />
                      Shamir's Secret Sharing (SSS) Emergency Recovery Scheme
                    </h4>
                    Splits your Master Encryption Key into N=5 threshold shares over Galois Field GF(2^8). Any K=3 shares can reconstruct your Master Vault Key, while fewer than K shares reveal zero information.
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleGenerateShamirShares(3, 5)}
                      className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
                    >
                      <QrCode className="h-4 w-4" /> Generate 3-of-5 Recovery Shares
                    </button>
                  </div>

                  {shamirShares.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                        Generated Emergency Paper Key Shares:
                      </p>
                      <div className="grid grid-cols-1 gap-2.5 font-mono text-[11px]">
                        {shamirShares.map((share) => (
                          <div key={share.id} className="p-3 bg-slate-900 text-emerald-400 rounded-xl border border-slate-700 flex items-center justify-between">
                            <span className="font-bold text-white">Share #{share.id}:</span>
                            <span className="truncate mx-2">{share.id}:{share.shareHex}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${share.id}:${share.shareHex}`);
                                alert(`Share #${share.id} copied to clipboard!`);
                              }}
                              className="p-1 rounded bg-slate-800 text-white hover:bg-slate-700"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: POST-QUANTUM HYBRID ENCRYPTION */}
              {securityTab === "pqc" && (
                <div className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs leading-relaxed text-emerald-900">
                    <h4 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2 mb-1">
                      <Cpu className="h-4 w-4 text-emerald-700" />
                      Post-Quantum Kyber-768 Hybrid Cryptography
                    </h4>
                    Layers NIST ML-KEM-768 (CRYSTALS-Kyber) lattice-based key encapsulation over classical AES-256-GCM via HKDF key combining to mitigate quantum decryption risks.
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={async () => {
                        const pair = await generateKyberKeyPair();
                        setPqcKeyPair(pair);
                      }}
                      className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" /> Generate ML-KEM-768 Keypair
                    </button>
                  </div>

                  {pqcKeyPair && (
                    <div className="space-y-3 font-mono text-xs">
                      <div className="p-3 bg-emerald-950 text-emerald-300 rounded-xl border border-emerald-800 space-y-2">
                        <p className="font-bold text-white uppercase text-[10px] tracking-wider">Kyber-768 Public Key (1184 bytes):</p>
                        <p className="truncate text-[10px]">{pqcKeyPair.publicKeyHex}</p>
                        <p className="font-bold text-white uppercase text-[10px] tracking-wider mt-2">Kyber-768 Secret Key (2400 bytes):</p>
                        <p className="truncate text-[10px]">{pqcKeyPair.privateKeyHex}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: MERKLE HASH TREE AUDIT LOG */}
              {securityTab === "audit" && (
                <div className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs leading-relaxed text-emerald-900 flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2 mb-1">
                        <GitCommit className="h-4 w-4 text-emerald-700" />
                        Tamper-Evident Merkle Hash Chain Audit Logs
                      </h4>
                      Cryptographically verifies that no rows or log entries have been injected, modified, or deleted in NeonDB PostgreSQL.
                    </div>
                    {auditVerification && (
                      <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                        auditVerification.valid
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-rose-100 text-rose-800 border-rose-300"
                      }`}>
                        {auditVerification.valid ? "✓ MERKLE CHAIN VALID" : "⚠️ TAMPERING DETECTED"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-xs">
                    {auditLogsList.map((log, idx) => (
                      <div key={log.id || idx} className="p-3 bg-white border border-emerald-200 rounded-xl shadow-2xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-emerald-800">#{idx+1} {log.event_type}</span>
                          <span className="text-emerald-800/60 font-sans">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] text-emerald-900 font-sans">{log.encrypted_details}</p>
                        <div className="text-[9px] text-emerald-800/70 truncate">
                          Hash: <code className="bg-emerald-50 px-1 rounded">{log.hash}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: ZERO-KNOWLEDGE PROOFS */}
              {securityTab === "zkp" && (
                <div className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs leading-relaxed text-emerald-900">
                    <h4 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2 mb-1">
                      <FileCheck className="h-4 w-4 text-emerald-700" />
                      Zero-Knowledge Selective Credential Disclosure
                    </h4>
                    Generates non-interactive zero-knowledge commitments and Fiat-Shamir proof signatures to prove possession of a secret or API key without revealing the secret itself.
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={async () => {
                        const proof = await generateZKProof(masterPassword || "SecretPass123!", "salt123");
                        setZkProofPayload(proof);
                        const result = await verifyZKProof(proof);
                        setZkVerifyResult(result);
                      }}
                      className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
                    >
                      <FileCheck className="h-4 w-4" /> Generate & Verify ZK-Proof
                    </button>
                  </div>

                  {zkProofPayload && (
                    <div className="p-4 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs space-y-2 border border-slate-700">
                      <p className="font-bold text-white">ZK Commitment Hash: {zkProofPayload.commitmentHash}</p>
                      <p className="text-white">Proof Signature: {zkProofPayload.proofSignature}</p>
                      {zkVerifyResult && (
                        <p className="text-emerald-300 font-sans font-bold text-xs mt-2 bg-emerald-950/80 p-2 rounded border border-emerald-700">
                          {zkVerifyResult.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: WEBAUTHN HARDWARE KEYS */}
              {securityTab === "webauthn" && (
                <div className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs leading-relaxed text-emerald-900">
                    <h4 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2 mb-1">
                      <Fingerprint className="h-4 w-4 text-emerald-700" />
                      Hardware-Backed Key Derivation (WebAuthn / FIDO2)
                    </h4>
                    Binds key derivation to your device's Touch ID, Windows Hello, or YubiKey PRF hardware secret.
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        const cred = await registerHardwareKey("VaultOwner");
                        setHardwareCred(cred);
                        alert("Hardware key bound successfully!");
                      } catch (err: any) {
                        alert("Hardware binding note: " + err.message);
                      }
                    }}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
                  >
                    <Fingerprint className="h-4 w-4" /> Register Hardware Security Key
                  </button>

                  {hardwareCred && (
                    <div className="p-3 bg-emerald-950 text-emerald-300 rounded-xl font-mono text-xs space-y-1">
                      <p className="font-bold text-white">Bound Credential ID:</p>
                      <p className="truncate text-[10px]">{hardwareCred.credentialIdHex}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: ACCESS ANOMALY IDS */}
              {securityTab === "ids" && (
                <div className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs leading-relaxed text-emerald-900">
                    <h4 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-emerald-700" />
                      Client-Side Access Pattern Anomaly Radar
                    </h4>
                    Evaluates velocity, hour of access, screen environment, and failure patterns to flag suspicious access behavior.
                  </div>

                  {anomalyReport && (
                    <div className="p-4 bg-white border border-emerald-200 rounded-xl space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-emerald-900">Anomaly Threat Risk Score:</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                          anomalyReport.riskLevel === "LOW" ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}>
                          {anomalyReport.riskScore}% — {anomalyReport.riskLevel} RISK
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-emerald-900">{anomalyReport.recommendation}</p>
                      <ul className="list-disc pl-5 text-xs text-emerald-800 space-y-1">
                        {anomalyReport.detectedAnomalies.map((anom, i) => (
                          <li key={i}>{anom}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: E2EE SHARING */}
              {securityTab === "sharing" && (
                <div className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs leading-relaxed text-emerald-900">
                    <h4 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2 mb-1">
                      <Share2 className="h-4 w-4 text-emerald-700" />
                      End-to-End Encrypted (E2EE) Asymmetric Public-Key Sharing
                    </h4>
                    Share encrypted secrets with specific users using X25519 / ECDH P-256 public key agreement.
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={async () => {
                        const pair = await generateUserKeyPair();
                        setSharingKeyPair(pair);
                        await registerPublicKey("User1", pair.publicKeyHex);
                        alert("E2EE Public Key generated and registered!");
                      }}
                      className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
                    >
                      <Users className="h-4 w-4" /> Register Sharing Key Pair
                    </button>
                  </div>

                  {sharingKeyPair && (
                    <div className="p-3 bg-slate-900 text-emerald-300 rounded-xl font-mono text-xs space-y-1">
                      <p className="font-bold text-white">Your Public Key Hex:</p>
                      <p className="truncate text-[10px]">{sharingKeyPair.publicKeyHex}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 8: HIBP BREACH AUDITOR */}
              {securityTab === "breach" && (
                <div className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs leading-relaxed text-emerald-900">
                    <h4 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2 mb-1">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      k-Anonymity HaveIBeenPwned API Breach Auditor
                    </h4>
                    Checks master password or stored passwords against HIBP database using 5-character SHA-1 prefixing without ever leaking passwords across the web.
                  </div>

                  <button
                    onClick={async () => {
                      setIsBreachLoading(true);
                      const res = await checkPasswordBreach(masterPassword || "password123");
                      const health = analyzePasswordHealth(masterPassword || "password123", res.breachCount);
                      setBreachReport(health);
                      setIsBreachLoading(false);
                    }}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
                  >
                    {isBreachLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Run k-Anonymity Breach Scan
                  </button>

                  {breachReport && (
                    <div className="p-4 bg-white border border-emerald-200 rounded-xl space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-emerald-900">Password Rating:</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                          breachReport.isBreached ? "bg-rose-100 text-rose-800 border-rose-300" : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}>
                          {breachReport.rating} ({breachReport.score}/100) — {breachReport.entropyBits} bits entropy
                        </span>
                      </div>
                      {breachReport.suggestions.map((sug, i) => (
                        <p key={i} className="text-xs text-emerald-900 font-semibold">{sug}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-emerald-100 bg-emerald-50/80">
              <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                Personal Vault v2.0 • Advanced Research Baseline
              </span>
              <button
                onClick={() => setSecurityModalOpen(false)}
                className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition"
              >
                Close Suite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IDE Floating Toasts */}
      <ToastContainer />

      {/* Command Palette Overlay */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={items}
        onSelectItem={(item) => {
          if (item.type === "folder") {
            setCurrentFolderId(item.id);
          } else {
            handleOpenPreview(item);
          }
        }}
        onRunAction={(actionId) => {
          if (actionId === "lock") {
            setIsLocked(true);
            toast.warning("Vault locked");
          } else if (actionId === "zen") {
            setIsZenMode((prev) => !prev);
            toast.info("Toggled Zen Mode");
          } else if (actionId === "theme-glass") {
            handleThemeChange("glass");
            toast.success("Glassmorphism Theme Applied");
          } else if (actionId === "theme-neo") {
            handleThemeChange("neo");
            toast.success("Neomorphism Theme Applied");
          } else if (actionId === "theme-clay") {
            handleThemeChange("clay");
            toast.success("Claymorphism Theme Applied");
          } else if (actionId === "cheatsheet") {
            setCheatsheetOpen(true);
          } else if (actionId === "export") {
            toast.info("Vault metadata ready for export");
          }
        }}
      />

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      <CheatsheetModal
        isOpen={cheatsheetOpen}
        onClose={() => setCheatsheetOpen(false)}
      />

      {/* IDE Status Bar */}
      {!isLocked && (
        <IDEStatusBar
          text={previewTextContent || previewItem?.notes || searchQuery || ""}
          cursorPos={editorCursorPos}
          languageMode={previewItem ? previewItem.type.toUpperCase() : activeSection.toUpperCase()}
          onOpenCheatsheet={() => setCheatsheetOpen(true)}
          onToggleZen={() => setIsZenMode((prev) => !prev)}
          isZenMode={isZenMode}
        />
      )}
    </div>
  );
}
