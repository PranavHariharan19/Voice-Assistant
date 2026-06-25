"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CryptoJS from "crypto-js";
import { getVaultItems, createVaultItem, updateVaultItem, deleteVaultItem } from "../actions";

interface VaultItem {
  id: string;
  title: string;
  content: string; // Encrypted text from server
  requires_item_password: boolean;
  item_password_hash: string | null;
  created_at: string;
}

export default function VaultDashboard() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormLoading, setCreateFormLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [viewItem, setViewItem] = useState<{ title: string, content: string } | null>(null);
  
  const [passwordPromptItem, setPasswordPromptItem] = useState<{ item: VaultItem, action: "view" | "edit" } | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);

  const [editItem, setEditItem] = useState<VaultItem & { decryptedContent: string, enteredPassword?: string } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFormLoading, setEditFormLoading] = useState(false);

  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showPromptPassword, setShowPromptPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [itemToDelete, setItemToDelete] = useState<VaultItem | null>(null);

  const [isBackupMode, setIsBackupMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);

  const [restoreErrors, setRestoreErrors] = useState<string[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ITEM_ENCRYPTION_KEY || "fallback_item_key";

  const filteredItems = items.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()));

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    const res = await getVaultItems();
    if (res.items) {
      setItems(res.items);
    }
    setLoading(false);
  }

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateFormLoading(true);
    setCreateError(null);

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const rawContent = formData.get("content") as string;
    const password = formData.get("password") as string;

    if (!title || !rawContent) {
      setCreateError("Title and content are required.");
      setCreateFormLoading(false);
      return;
    }

    try {
      const encryptedContent = CryptoJS.AES.encrypt(rawContent, ENCRYPTION_KEY).toString();
      const requires_item_password = !!password;
      const item_password_hash = requires_item_password ? CryptoJS.SHA256(password).toString() : null;

      const newFormData = new FormData();
      newFormData.append("title", title);
      newFormData.append("content", encryptedContent);
      newFormData.append("requires_item_password", requires_item_password.toString());
      if (item_password_hash) {
        newFormData.append("item_password_hash", item_password_hash);
      }

      const res = await createVaultItem(newFormData);
      if (res.error) {
        setCreateError(res.error);
      } else {
        setShowCreateModal(false);
        loadItems();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setCreateError(errorMessage || "Encryption failed");
    } finally {
      setCreateFormLoading(false);
    }
  }

  function handleCardClick(item: VaultItem) {
    if (item.requires_item_password) {
      setPasswordPromptItem({ item, action: "view" });
      setPromptError(null);
    } else {
      openView(item);
    }
  }

  function openView(item: VaultItem) {
    try {
      const bytes = CryptoJS.AES.decrypt(item.content, ENCRYPTION_KEY);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      if (!originalText) throw new Error("Decryption resulted in empty string (wrong key?)");
      setViewItem({ title: item.title, content: originalText });
    } catch {
      alert("Failed to decrypt content.");
    }
  }

  function openEdit(item: VaultItem, enteredPassword?: string) {
    try {
      const bytes = CryptoJS.AES.decrypt(item.content, ENCRYPTION_KEY);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      if (!originalText) throw new Error("Decryption resulted in empty string");
      setEditItem({ ...item, decryptedContent: originalText, enteredPassword });
    } catch {
      alert("Failed to decrypt content for editing.");
    }
  }

  function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!passwordPromptItem) return;
    setPromptError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const hash = CryptoJS.SHA256(password).toString();

    if (hash === passwordPromptItem.item.item_password_hash) {
      if (passwordPromptItem.action === "edit") {
        openEdit(passwordPromptItem.item, password);
      } else {
        openView(passwordPromptItem.item);
      }
      setPasswordPromptItem(null);
    } else {
      setPromptError("Incorrect password");
    }
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editItem) return;
    setEditFormLoading(true);
    setEditError(null);

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const rawContent = formData.get("content") as string;
    const newPassword = formData.get("password") as string;

    if (!title || !rawContent) {
      setEditError("Title and content are required.");
      setEditFormLoading(false);
      return;
    }

    try {
      const encryptedContent = CryptoJS.AES.encrypt(rawContent, ENCRYPTION_KEY).toString();
      const requires_item_password = !!newPassword;
      const item_password_hash = requires_item_password ? CryptoJS.SHA256(newPassword).toString() : null;

      const newFormData = new FormData();
      newFormData.append("id", editItem.id);
      newFormData.append("title", title);
      newFormData.append("content", encryptedContent);
      newFormData.append("requires_item_password", requires_item_password.toString());
      if (item_password_hash) {
        newFormData.append("item_password_hash", item_password_hash);
      }

      const res = await updateVaultItem(newFormData);
      if (res.error) {
        setEditError(res.error);
      } else {
        setEditItem(null);
        loadItems();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setEditError(errorMessage || "Encryption failed");
    } finally {
      setEditFormLoading(false);
    }
  }

  async function confirmDelete() {
    if (!itemToDelete) return;
    setLoading(true);
    const res = await deleteVaultItem(itemToDelete.id);
    if (res.error) {
      alert("Failed to delete: " + res.error);
      setLoading(false);
    } else {
      setItemToDelete(null);
      loadItems();
    }
  }

  function executeBackup() {
    const itemsToExport = items.filter(i => selectedItems.has(i.id));
    
    itemsToExport.forEach((item, index) => {
      setTimeout(() => {
        try {
          const bytes = CryptoJS.AES.decrypt(item.content, ENCRYPTION_KEY);
          const originalText = bytes.toString(CryptoJS.enc.Utf8);
          
          const fileContent = `Locker: ${item.title}\nCreated: ${new Date(item.created_at).toLocaleString()}\n\n${originalText || "Failed to decrypt content"}`;
          
          const blob = new Blob([fileContent], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_backup.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch {
          console.error("Backup decryption failed for item:", item.title);
        }
      }, index * 200); // slight delay to prevent browser blocking multiple downloads
    });

    setIsBackupMode(false);
    setSelectedItems(new Set());
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsRestoring(true);
    setRestoreErrors([]);
    const errors: string[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        const lines = text.split('\n');
        
        if (lines.length < 3 || !lines[0].startsWith('Locker: ') || !lines[1].startsWith('Created: ')) {
          errors.push(`'${file.name}' is incompatible. (Missing Locker/Created headers)`);
          continue;
        }

        const title = lines[0].replace('Locker: ', '').trim();
        const content = lines.slice(3).join('\n').trim();

        if (!title || !content) {
          errors.push(`'${file.name}' is incompatible. (Empty title or content)`);
          continue;
        }

        const encryptedContent = CryptoJS.AES.encrypt(content, ENCRYPTION_KEY).toString();

        const newFormData = new FormData();
        newFormData.append("title", title);
        newFormData.append("content", encryptedContent);
        newFormData.append("requires_item_password", "false");

        const res = await createVaultItem(newFormData);
        if (res.error) {
          errors.push(`'${file.name}': Server error - ${res.error}`);
        }
      } catch {
        errors.push(`'${file.name}': Failed to read file`);
      }
    }

    if (errors.length > 0) {
      setRestoreErrors(errors);
    }
    
    // Clear input
    e.target.value = '';
    
    await loadItems();
    setIsRestoring(false);
  }

  return (
    <div className="min-h-screen bg-[#E4DDD3] p-4 sm:p-8">
      <header className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-10 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-[#17211F]">Vault Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {items.length > 0 && (
            <>
              <button
                onClick={() => {
                  setIsBackupMode(!isBackupMode);
                  setSelectedItems(new Set());
                }}
                className={`px-6 py-2 rounded-full font-bold transition shadow-[0_8px_20px_rgba(0,161,155,0.28)] ${isBackupMode ? 'bg-red-500 text-white shadow-[0_8px_20px_rgba(239,68,68,0.28)]' : 'bg-[#00A19B] text-white'}`}
              >
                {isBackupMode ? 'Cancel Backup' : 'Backup'}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#00A19B] text-white px-6 py-2 rounded-full font-bold shadow-[0_8px_20px_rgba(0,161,155,0.28)] hover:-translate-y-0.5 transition"
              >
                Create Locker
              </button>
            </>
          )}
          <label className={`cursor-pointer px-6 py-2 rounded-full font-bold shadow-[0_8px_20px_rgba(0,161,155,0.28)] hover:-translate-y-0.5 transition flex items-center justify-center ${isRestoring ? 'bg-[#00A19B]/50 text-white pointer-events-none' : 'bg-[#00A19B] text-white'}`}>
            {isRestoring ? 'Restoring...' : 'Restore'}
            <input 
              type="file" 
              accept=".txt" 
              multiple 
              className="hidden" 
              onChange={handleRestore}
              disabled={isRestoring}
            />
          </label>
          <Link href="/calendar" className="text-[#17211F]/60 font-bold hover:text-[#00A19B] transition">
            Exit Vault
          </Link>
        </div>
      </header>

      {items.length > 0 && (
        <div className="max-w-6xl mx-auto mb-8">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search lockers by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/70 backdrop-blur-md border border-[#17211F]/10 rounded-full px-5 py-3 pl-12 text-sm font-bold text-[#17211F] placeholder:text-[#17211F]/40 focus:outline-none focus:ring-2 focus:ring-[#00A19B]/50 shadow-sm transition"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[#17211F]/40" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
            </svg>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto relative min-h-[500px]">

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#00A19B] border-t-transparent"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[#17211F]/60 font-medium mb-6">Your vault is empty.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#00A19B] text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-[0_12px_28px_rgba(0,161,155,0.28)] hover:-translate-y-1 transition"
            >
              Create Locker
            </button>
          </div>
        ) : (
          <>
            {isBackupMode && filteredItems.length > 0 && (
              <div className="flex items-center gap-3 mb-6 bg-white/70 backdrop-blur-md border border-[#17211F]/10 p-4 rounded-xl w-fit shadow-sm">
                <input 
                  type="checkbox" 
                  checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const newSet = new Set(selectedItems);
                      filteredItems.forEach(i => newSet.add(i.id));
                      setSelectedItems(newSet);
                    } else {
                      const newSet = new Set(selectedItems);
                      filteredItems.forEach(i => newSet.delete(i.id));
                      setSelectedItems(newSet);
                    }
                  }}
                  className="w-5 h-5 accent-[#00A19B] rounded cursor-pointer"
                />
                <span className="font-bold text-[#17211F]">Select All</span>
              </div>
            )}
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#17211F]/60 font-medium">
                No lockers found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {filteredItems.map((item) => (
                  <div
                  key={item.id}
                  onClick={() => {
                    if (isBackupMode) {
                      const newSet = new Set(selectedItems);
                      if (newSet.has(item.id)) newSet.delete(item.id);
                      else newSet.add(item.id);
                      setSelectedItems(newSet);
                    } else {
                      handleCardClick(item);
                    }
                  }}
                  className={`group relative bg-white/70 backdrop-blur-md border rounded-2xl p-6 shadow-sm hover:shadow-lg transition flex flex-col justify-between h-48 cursor-pointer ${isBackupMode && selectedItems.has(item.id) ? 'border-[#00A19B] ring-2 ring-[#00A19B]/30' : 'border-[#17211F]/10'}`}
                >
                  {isBackupMode ? (
                    <div className="absolute top-4 left-4 z-10">
                      <input 
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => {}} 
                        className="w-5 h-5 accent-[#00A19B] rounded cursor-pointer pointer-events-none"
                      />
                    </div>
                  ) : item.requires_item_password && (
                    <div className="absolute top-4 left-4 text-[#17211F]/50">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                      </svg>
                    </div>
                  )}
                  
                  {!isBackupMode && (
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.requires_item_password) {
                            setPasswordPromptItem({ item, action: "edit" });
                            setPromptError(null);
                          } else {
                            openEdit(item);
                          }
                        }}
                        className="p-2 text-[#17211F]/30 hover:text-[#00A19B] bg-white/80 rounded-full shadow-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToDelete(item);
                        }}
                        className="p-2 text-[#17211F]/30 hover:text-red-500 bg-white/80 rounded-full shadow-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                          <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                      </button>
                    </div>
                  )}

                <h2 className="text-xl font-bold text-[#17211F] mt-4 line-clamp-2">{item.title}</h2>
                <div className="text-right text-xs font-bold text-[#17211F]/40 mt-auto">
                  {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Export Action Button */}
      {isBackupMode && selectedItems.size > 0 && (
        <div className="fixed bottom-8 right-8 z-40">
          <button 
            onClick={() => setShowBackupConfirm(true)}
            className="bg-[#00A19B] text-white px-8 py-4 rounded-full font-bold text-lg shadow-[0_12px_28px_rgba(0,161,155,0.28)] hover:-translate-y-1 transition flex items-center gap-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
              <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
            </svg>
            Export {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Backup Confirmation Modal */}
      {showBackupConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl relative text-center">
            <h2 className="text-xl font-bold text-[#17211F] mb-2">Export Backup</h2>
            <p className="text-sm font-medium text-[#17211F]/60 mb-6">Do you want to take a backup of {selectedItems.size} locker{selectedItems.size !== 1 ? 's' : ''}? They will be downloaded as individual text files.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowBackupConfirm(false)} className="flex-1 py-3 font-bold text-[#17211F]/60 hover:bg-gray-100 rounded-xl transition">Cancel</button>
              <button 
                onClick={() => {
                  setShowBackupConfirm(false);
                  executeBackup();
                }} 
                className="flex-1 bg-[#00A19B] text-white font-bold py-3 rounded-xl shadow-[0_8px_20px_rgba(0,161,155,0.28)] hover:-translate-y-0.5 transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-bold text-[#17211F] mb-6">Create New Locker</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#17211F]/60 uppercase ml-1">Title</label>
                <input required name="title" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00A19B]/50" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#17211F]/60 uppercase ml-1">Content to Encrypt</label>
                <textarea required name="content" rows={4} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00A19B]/50" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#17211F]/60 uppercase ml-1">Password (Optional)</label>
                <div className="relative">
                  <input name="password" type={showCreatePassword ? "text" : "password"} placeholder="Leave empty for no password" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00A19B]/50 pr-10" />
                  <button type="button" onClick={() => setShowCreatePassword(!showCreatePassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showCreatePassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.79 12.912l-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7.029 7.029 0 0 0 2.79-.588zM5.21 3.088A7.028 7.028 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474L5.21 3.089z"/><path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829l-2.83-2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12-.708.708z"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg>
                    )}
                  </button>
                </div>
              </div>
              {createError && <p className="text-red-500 text-sm font-bold text-center">{createError}</p>}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3 font-bold text-[#17211F]/60 hover:bg-gray-100 rounded-xl transition">Cancel</button>
                <button disabled={createFormLoading} type="submit" className="flex-1 bg-[#00A19B] text-white font-bold py-3 rounded-xl shadow-[0_8px_20px_rgba(0,161,155,0.28)] hover:-translate-y-0.5 transition disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Item Modal */}
      {viewItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setViewItem(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
            </button>
            <h2 className="text-2xl font-bold text-[#17211F] mb-6 pr-8">{viewItem.title}</h2>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap max-h-96 overflow-y-auto border border-gray-200">
              {viewItem.content}
            </div>
          </div>
        </div>
      )}

      {/* Password Prompt Modal */}
      {passwordPromptItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setPasswordPromptItem(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
            </button>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-center text-[#17211F] mb-6">Locker Protected</h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <input required autoFocus name="password" type={showPromptPassword ? "text" : "password"} placeholder="Enter locker password" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00A19B]/50 text-center pr-10" />
                <button type="button" onClick={() => setShowPromptPassword(!showPromptPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPromptPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.79 12.912l-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7.029 7.029 0 0 0 2.79-.588zM5.21 3.088A7.028 7.028 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474L5.21 3.089z"/><path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829l-2.83-2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12-.708.708z"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg>
                  )}
                </button>
              </div>
              {promptError && <p className="text-red-500 text-xs font-bold text-center">{promptError}</p>}
              <button type="submit" className="w-full bg-[#00A19B] text-white font-bold py-3 rounded-xl shadow-[0_8px_20px_rgba(0,161,155,0.28)] hover:-translate-y-0.5 transition">Unlock</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Locker Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl relative">
            <h2 className="text-2xl font-bold text-[#17211F] mb-6">Edit Locker</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#17211F]/60 uppercase ml-1">Title</label>
                <input required defaultValue={editItem.title} name="title" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00A19B]/50" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#17211F]/60 uppercase ml-1">Content</label>
                <textarea required defaultValue={editItem.decryptedContent} name="content" rows={4} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00A19B]/50" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#17211F]/60 uppercase ml-1">Password</label>
                <div className="relative">
                  <input defaultValue={editItem.enteredPassword || ""} name="password" type={showEditPassword ? "text" : "password"} placeholder="Leave empty to remove protection" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00A19B]/50 pr-10" />
                  <button type="button" onClick={() => setShowEditPassword(!showEditPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showEditPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.79 12.912l-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7.029 7.029 0 0 0 2.79-.588zM5.21 3.088A7.028 7.028 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474L5.21 3.089z"/><path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829l-2.83-2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12-.708.708z"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg>
                    )}
                  </button>
                </div>
              </div>
              {editError && <p className="text-red-500 text-sm font-bold text-center">{editError}</p>}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setEditItem(null)} className="flex-1 py-3 font-bold text-[#17211F]/60 hover:bg-gray-100 rounded-xl transition">Cancel</button>
                <button disabled={editFormLoading} type="submit" className="flex-1 bg-[#00A19B] text-white font-bold py-3 rounded-xl shadow-[0_8px_20px_rgba(0,161,155,0.28)] hover:-translate-y-0.5 transition disabled:opacity-50">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl relative text-center">
            <button onClick={() => setItemToDelete(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
            </button>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                  <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-[#17211F] mb-2">Delete Locker?</h2>
            <p className="text-sm font-medium text-[#17211F]/60 mb-6">Are you sure you want to delete this locker? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setItemToDelete(null)} className="flex-1 py-3 font-bold text-[#17211F]/60 hover:bg-gray-100 rounded-xl transition">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl shadow-[0_8px_20px_rgba(239,68,68,0.28)] hover:-translate-y-0.5 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Errors Modal */}
      {restoreErrors.length > 0 && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setRestoreErrors([])} className="absolute top-4 right-4 text-gray-400 hover:text-black">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
            </button>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-center text-[#17211F] mb-6">Restore Issues</h2>
            <ul className="text-sm text-gray-700 space-y-2 max-h-64 overflow-y-auto bg-red-50 p-4 rounded-xl border border-red-100 font-medium">
              {restoreErrors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
            <button onClick={() => setRestoreErrors([])} className="w-full mt-6 bg-[#17211F] text-white font-bold py-3 rounded-xl hover:-translate-y-0.5 transition">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}
