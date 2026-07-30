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
} from "lucide-react";
import {
  initDatabase,
  getVaultItems,
  getAllFolders,
  getFolderBreadcrumbs,
  addFolder,
  addCredentialItem,
  uploadDocumentDirect,
  getPresignedUploadUrl,
  addDocumentMetadata,
  getPresignedDownloadUrl,
  deleteVaultItem,
  renameVaultItem,
  moveVaultItem,
  copyVaultItem,
  VaultItem,
} from "@/app/actions/vault";
import { deriveKey, encryptText, decryptText } from "@/lib/crypto";

export default function FormalGreenWhiteVault() {
  const [isLocked, setIsLocked] = useState(true);
  const [masterPassword, setMasterPassword] = useState("");
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  // Navigation & View state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; title: string }[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "document" | "password" | "note">("all");

  // Items & folders cache
  const [items, setItems] = useState<VaultItem[]>([]);
  const [allFolders, setAllFolders] = useState<{ id: string; title: string; parent_id: string | null }[]>([]);
  const [isPending, startTransition] = useTransition();

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

  // Form states
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [secretPassword, setSecretPassword] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Decrypted cache & Feedback
  const [decryptedCache, setDecryptedCache] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  // Init DB
  useEffect(() => {
    initDatabase();
  }, []);

  // Fetch items when currentFolderId changes
  const fetchCurrentContents = () => {
    startTransition(async () => {
      const res = await getVaultItems(currentFolderId);
      if (res.success && res.data) {
        setItems(res.data);
      }
      const foldersRes = await getAllFolders();
      if (foldersRes.success && foldersRes.data) {
        setAllFolders(foldersRes.data);
      }
      const crumbsRes = await getFolderBreadcrumbs(currentFolderId);
      if (crumbsRes.success && crumbsRes.data) {
        setBreadcrumbs(crumbsRes.data);
      }
    });
  };

  useEffect(() => {
    if (!isLocked) {
      fetchCurrentContents();
    }
  }, [currentFolderId, isLocked]);

  // Handle Master Password Unlock
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword.trim()) {
      setUnlockError("Please enter a master password.");
      return;
    }
    setIsUnlocking(true);
    setUnlockError("");

    try {
      const key = await deriveKey(masterPassword);
      setCryptoKey(key);
      setIsLocked(false);
    } catch (err: any) {
      setUnlockError("Failed to derive encryption key.");
    } finally {
      setIsUnlocking(false);
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

  // Add Document Upload via Server Action (Bypasses CORS)
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return alert("Please select a document.");

    setIsAdding(true);
    setUploadProgress(50);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (title) formData.append("title", title);
      if (notes) formData.append("notes", notes);
      if (currentFolderId) formData.append("parentId", currentFolderId);

      const res = await uploadDocumentDirect(formData);

      if (res.success) {
        setTitle("");
        setSelectedFile(null);
        setNotes("");
        setAddRecordModalOpen(false);
        fetchCurrentContents();
      } else {
        alert("Upload error: " + res.error);
      }
    } catch (err: any) {
      alert("Error uploading file: " + err.message);
    } finally {
      setUploadProgress(null);
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
      const res = await getPresignedDownloadUrl(item.storage_key, item.file_name);
      if (res.success && res.downloadUrl) {
        setPreviewUrl(res.downloadUrl);

        // Fetch raw text for text/code files
        const ext = item.file_name.split(".").pop()?.toLowerCase() || "";
        if (["txt", "json", "js", "ts", "jsx", "tsx", "py", "md", "html", "css", "csv", "log"].includes(ext)) {
          setIsLoadingText(true);
          try {
            const text = await fetch(res.downloadUrl).then((r) => r.text());
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

  // Delete
  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    const res = await deleteVaultItem(id);
    if (res.success) {
      fetchCurrentContents();
    } else {
      alert("Delete failed: " + res.error);
    }
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

      if (filterType === "all") return matchesSearch;
      if (filterType === "document") return item.type === "document" && matchesSearch;
      if (filterType === "password") return (item.type === "password" || item.type === "credential") && matchesSearch;
      if (filterType === "note") return item.type === "note" && matchesSearch;
      return matchesSearch;
    });
  }, [items, searchQuery, filterType]);

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

  // Lock Overlay Screen (Formal Green & White Theme)
  if (isLocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f2f7f4] px-4 font-sans text-emerald-950 relative overflow-hidden">
        {/* Subtle mint background glows */}
        <div className="absolute top-1/4 left-1/3 -z-10 h-96 w-96 rounded-full bg-emerald-200/40 blur-[130px]"></div>

        <div className="w-full max-w-md rounded-2xl glass-panel p-8 shadow-xl border border-emerald-200/80">
          <div className="mb-8 flex flex-col items-center text-center">
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

          <form onSubmit={handleUnlock} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-2">
                Master Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Enter master password..."
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
                  Deriving Security Key...
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4" />
                  Unlock Cloud Vault
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f8f6] text-emerald-950 flex flex-col font-sans">
      {/* Top Formal Navbar */}
      <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-emerald-950">
                PERSONAL VAULT
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-800">
                  NeonDB & Cloudflare R2 Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchCurrentContents}
              disabled={isPending}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50 transition"
              title="Refresh Folder"
            >
              <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleLock}
              className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
            >
              <Lock className="h-3.5 w-3.5" />
              Lock Vault
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Split Layout */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full px-6 py-6 gap-6">
        {/* Left Sidebar Navigation */}
        <aside className="w-64 shrink-0 space-y-6">
          <div className="rounded-xl glass-panel p-4 space-y-2 border border-emerald-100">
            <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-900/60 px-3 mb-2">
              File Categories
            </p>
            <button
              onClick={() => setFilterType("all")}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition ${
                filterType === "all" ? "bg-emerald-800 text-white shadow-sm shadow-emerald-900/10" : "text-emerald-900 hover:bg-emerald-50"
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              All Contents
            </button>
            <button
              onClick={() => setFilterType("document")}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition ${
                filterType === "document" ? "bg-emerald-800 text-white shadow-sm shadow-emerald-900/10" : "text-emerald-900 hover:bg-emerald-50"
              }`}
            >
              <File className="h-4 w-4 text-emerald-600" />
              Documents & Files
            </button>
            <button
              onClick={() => setFilterType("password")}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition ${
                filterType === "password" ? "bg-emerald-800 text-white shadow-sm shadow-emerald-900/10" : "text-emerald-900 hover:bg-emerald-50"
              }`}
            >
              <Key className="h-4 w-4 text-emerald-700" />
              Logins & Passwords
            </button>
            <button
              onClick={() => setFilterType("note")}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition ${
                filterType === "note" ? "bg-emerald-800 text-white shadow-sm shadow-emerald-900/10" : "text-emerald-900 hover:bg-emerald-50"
              }`}
            >
              <FileText className="h-4 w-4 text-emerald-600" />
              Secure Notes
            </button>
          </div>

          {/* Directory Tree */}
          <div className="rounded-xl glass-panel p-4 space-y-3 border border-emerald-100">
            <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-900/60 px-3">
              Folder Navigation
            </p>
            <div className="space-y-1">
              <button
                onClick={() => setCurrentFolderId(null)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  currentFolderId === null ? "bg-emerald-100 text-emerald-950 font-bold" : "text-emerald-900 hover:bg-emerald-50"
                }`}
              >
                <Home className="h-3.5 w-3.5 text-emerald-700" />
                Root Vault
              </button>
              {allFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setCurrentFolderId(folder.id)}
                  className={`flex w-full items-center gap-2 px-6 py-1.5 text-xs font-bold rounded-lg truncate transition ${
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

        {/* Main Explorer Canvas */}
        <main className="flex-1 flex flex-col space-y-4 min-w-0">
          {/* Top Explorer Actions Toolbar */}
          <div className="rounded-xl glass-panel p-4 flex flex-col sm:flex-row gap-4 items-center justify-between border border-emerald-100">
            {/* Breadcrumb Path Bar */}
            <div className="flex items-center gap-1.5 text-xs text-emerald-900 overflow-x-auto w-full sm:w-auto">
              <button
                onClick={() => setCurrentFolderId(null)}
                className="flex items-center gap-1 hover:text-emerald-700 font-bold transition shrink-0"
              >
                <Home className="h-3.5 w-3.5 text-emerald-700" />
                Vault
              </button>
              {breadcrumbs.map((crumb) => (
                <div key={crumb.id} className="flex items-center gap-1 shrink-0">
                  <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />
                  <button
                    onClick={() => setCurrentFolderId(crumb.id)}
                    className={`hover:text-emerald-700 transition ${
                      currentFolderId === crumb.id ? "text-emerald-950 font-extrabold" : "font-semibold"
                    }`}
                  >
                    {crumb.title}
                  </button>
                </div>
              ))}
            </div>

            {/* Action Buttons & View Toggles */}
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <button
                onClick={() => setNewFolderModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100 text-xs font-bold transition"
              >
                <FolderPlus className="h-3.5 w-3.5 text-emerald-700" />
                New Folder
              </button>

              <button
                onClick={() => {
                  setRecordTab("document");
                  setAddRecordModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-bold shadow-sm shadow-emerald-700/20 transition"
              >
                <CloudUpload className="h-3.5 w-3.5" />
                Upload Document
              </button>

              <button
                onClick={() => {
                  setRecordTab("password");
                  setAddRecordModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950 text-white hover:bg-emerald-900 text-xs font-bold transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Record
              </button>

              <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-lg p-0.5 ml-2">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition ${
                    viewMode === "grid" ? "bg-white text-emerald-950 shadow-xs" : "text-emerald-700 hover:text-emerald-950"
                  }`}
                  title="Grid View"
                >
                  <Grid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition ${
                    viewMode === "list" ? "bg-white text-emerald-950 shadow-xs" : "text-emerald-700 hover:text-emerald-950"
                  }`}
                  title="List View"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Search bar & info row */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-emerald-800">
              Showing <span className="text-emerald-950 font-bold">{filteredItems.length}</span> items in directory
            </p>

            <div className="relative w-64">
              <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-emerald-600" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-emerald-200 bg-white pl-8 pr-3 py-1.5 text-xs text-emerald-950 placeholder-emerald-800/40 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Explorer Content Canvas */}
          {filteredItems.length === 0 ? (
            <div className="flex-1 rounded-xl border border-dashed border-emerald-200 bg-white/60 p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <FolderOpen className="h-12 w-12 text-emerald-400 mb-3" />
              <p className="text-emerald-900 font-bold text-sm">This folder is empty</p>
              <p className="text-xs text-emerald-800/70 mt-1 max-w-sm">
                Upload documents, create subfolders, or store passwords and secret notes inside!
              </p>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View Layout */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-xl glass-panel glass-panel-hover p-4 flex flex-col justify-between cursor-pointer border border-emerald-100/80 bg-white"
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
                    <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-100">
                      {getFileIcon(item)}
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
                        <div className="absolute right-0 top-6 z-20 w-36 rounded-lg border border-emerald-200 bg-white py-1 shadow-xl text-xs">
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
                          <button
                            onClick={() => {
                              setActionMenuOpenId(null);
                              handleDeleteItem(item.id);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-rose-700 hover:bg-rose-50 font-medium transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Metadata */}
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-emerald-950 truncate" title={item.title}>
                      {item.title}
                    </h3>
                    <p className="text-[11px] font-medium text-emerald-800/70 truncate">
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
            <div className="rounded-xl glass-panel border border-emerald-100 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs text-emerald-950">
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
                      onClick={() => {
                        if (item.type === "folder") {
                          setCurrentFolderId(item.id);
                        } else {
                          handleOpenPreview(item);
                        }
                      }}
                      className="hover:bg-emerald-50/60 cursor-pointer transition"
                    >
                      <td className="px-4 py-3 flex items-center gap-3 font-bold text-emerald-950">
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
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 transition"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">Select File</label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-emerald-200 bg-white p-2 text-xs text-emerald-900 font-medium"
                  />
                </div>
                {uploadProgress !== null && (
                  <p className="text-xs text-emerald-700 font-bold">Uploading: {uploadProgress}%</p>
                )}
                <button
                  type="submit"
                  disabled={isAdding || !selectedFile}
                  className="w-full py-2.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition shadow-sm"
                >
                  Upload File
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
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/50 backdrop-blur-md ${isPreviewMaximized ? "p-0" : "p-4"}`}>
          <div className={`w-full flex flex-col space-y-4 glass-panel border border-emerald-200 bg-white shadow-2xl transition-all duration-200 ${
            isPreviewMaximized
              ? "h-screen w-screen max-w-none max-h-none rounded-none p-6 bg-white"
              : "max-w-4xl max-h-[90vh] rounded-xl p-6"
          }`}>
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-3">
                {getFileIcon(previewItem)}
                <div>
                  <h3 className="text-base font-bold text-emerald-950">{previewItem.title}</h3>
                  <p className="text-xs text-emerald-800/70 font-semibold uppercase">{previewItem.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
            <div className={`flex-1 overflow-y-auto bg-emerald-50/50 rounded-lg border border-emerald-100 p-4 flex items-center justify-center ${
              isPreviewMaximized ? "h-[calc(100vh-140px)] max-h-none" : "min-h-[300px]"
            }`}>
              {previewItem.type === "document" ? (
                previewUrl ? (
                  previewItem.file_name?.match(/\.(doc|docx|ppt|pptx|xls|xlsx)$/i) ? (
                    <div className="w-full h-full flex flex-col items-center">
                      <iframe
                        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
                        className={`w-full rounded border border-emerald-200 bg-white ${
                          isPreviewMaximized ? "h-[calc(100vh-180px)]" : "h-[520px]"
                        }`}
                        title="Office Document Preview"
                      ></iframe>
                    </div>
                  ) : previewItem.file_name?.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i) ? (
                    <img
                      src={previewUrl}
                      alt={previewItem.title}
                      className={`object-contain rounded shadow-md ${
                        isPreviewMaximized ? "max-h-[calc(100vh-180px)]" : "max-h-[500px]"
                      }`}
                    />
                  ) : previewItem.file_name?.endsWith(".pdf") ? (
                    <iframe
                      src={previewUrl}
                      className={`w-full rounded border border-emerald-200 bg-white ${
                        isPreviewMaximized ? "h-[calc(100vh-180px)]" : "h-[520px]"
                      }`}
                      title="PDF Preview"
                    ></iframe>
                  ) : previewItem.file_name?.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                    <video
                      controls
                      src={previewUrl}
                      className={`w-full rounded ${
                        isPreviewMaximized ? "max-h-[calc(100vh-180px)]" : "max-h-[500px]"
                      }`}
                    />
                  ) : previewItem.file_name?.match(/\.(mp3|wav|aac|m4a)$/i) ? (
                    <div className="w-full px-6 py-8">
                      <audio controls src={previewUrl} className="w-full" />
                    </div>
                  ) : previewItem.file_name?.match(/\.(txt|json|js|ts|jsx|tsx|py|md|html|css|csv|log)$/i) ? (
                    isLoadingText ? (
                      <RefreshCw className="h-6 w-6 animate-spin text-emerald-700" />
                    ) : (
                      <pre className={`w-full overflow-auto text-xs font-mono bg-[#06241b] p-4 rounded border border-emerald-800 text-emerald-300 whitespace-pre-wrap ${
                        isPreviewMaximized ? "h-[calc(100vh-180px)] max-h-none" : "max-h-[500px]"
                      }`}>
                        {previewTextContent || "No content"}
                      </pre>
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
    </div>
  );
}
