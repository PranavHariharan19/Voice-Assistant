"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CryptoJS from "crypto-js";
import { getVaultStatus, setupVault, verifyVault } from "./actions";

export default function VaultPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "needs_setup" | "ready" | "unauthorized">("loading");
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    getVaultStatus().then((res) => {
      setStatus(res.status as "needs_setup" | "ready" | "unauthorized");
    });
  }, []);

  if (status === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#E4DDD3]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#00A19B] border-t-transparent"></div>
      </div>
    );
  }

  if (status === "unauthorized") {
    return <div className="p-10 text-center">Unauthorized. Please log in.</div>;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoadingAction(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    
    if (!password) {
      setError("Password is required");
      setLoadingAction(false);
      return;
    }

    try {
      // Hash the master password on the client side so the server never sees the plaintext
      const hashedPassword = CryptoJS.SHA256(password).toString();
      
      const newFormData = new FormData();
      newFormData.append("password", hashedPassword);

      let res;
      if (status === "needs_setup") {
        res = await setupVault(newFormData);
        if (res?.success) {
          window.location.reload(); // Reload to show the enter password screen
        }
      } else {
        res = await verifyVault(newFormData);
        if (res?.success) {
          router.push('/vault/dashboard');
        }
      }

      if (res?.error) {
        setError(res.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError("Encryption failed: " + errorMessage);
    } finally {
      setLoadingAction(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#E4DDD3]">
      <div className="bg-white/70 backdrop-blur-2xl border border-[#17211F]/10 rounded-[32px] p-8 shadow-xl max-w-md w-full mx-4">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00A19B] rounded-2xl shadow-[0_12px_28px_rgba(0,161,155,0.28)] mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="white" viewBox="0 0 16 16">
              <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[#17211F]">Secure Vault</h1>
          <p className="mt-2 text-[#17211F]/60 font-medium">
            {status === "needs_setup" ? "Create your master password" : "Enter your master password"}
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#17211F]/60 uppercase ml-1">Master Password</label>
            <input
              required
              name="password"
              type="password"
              placeholder="••••••••"
              className="w-full bg-white/50 border border-[#17211F]/10 rounded-2xl px-5 py-3 text-sm font-medium focus:outline-none focus:border-[#00A19B] focus:ring-4 focus:ring-[#00A19B]/10 transition-all text-[#17211F]"
            />
          </div>

          {error && (
            <p className="text-xs font-bold text-center p-3 rounded-xl bg-red-50 text-[#D56B68]">
              {error}
            </p>
          )}

          <button
            disabled={loadingAction}
            type="submit"
            className="w-full bg-[#00A19B] text-white font-bold py-4 rounded-2xl shadow-[0_12px_28px_rgba(0,161,155,0.28)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {loadingAction ? "Processing..." : status === "needs_setup" ? "Set Password" : "Unlock Vault"}
          </button>
        </form>
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm font-bold text-[#17211F]/60 hover:text-[#00A19B] transition-colors">
            Return to Calendar
          </Link>
        </div>
      </div>
    </div>
  );
}
