"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import { LogIn, LogOut, UserRound, X } from "lucide-react";
import { useAuth } from "@/features/auth/use-auth";
import { oauthRedirectUrl, type OAuthProvider } from "@/features/auth/oauth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useDialog } from "@/hooks/use-dialog";

function displayName(user: User) {
  const metadata = user.user_metadata ?? {};
  return String(
    metadata.full_name ??
      metadata.name ??
      user.email?.split("@")[0] ??
      "Tài khoản",
  );
}

export function AuthControl() {
  const { user, supabase } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogRef = useDialog<HTMLElement>(() => setOpen(false), open);

  async function signIn(provider: OAuthProvider) {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const redirectTo = oauthRedirectUrl();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (authError) {
      setError("Chưa thể mở trang đăng nhập. Hãy thử lại.");
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    const { error: authError } = await supabase.auth.signOut();
    setBusy(false);
    if (authError) setError("Chưa thể đăng xuất. Hãy thử lại.");
    else setOpen(false);
  }

  return (
    <>
      <button
        className="auth-trigger"
        onClick={() => setOpen(true)}
        aria-label={user ? `Tài khoản ${displayName(user)}` : "Đăng nhập"}
      >
        <UserRound size={17} aria-hidden="true" />
        <span>{user ? displayName(user) : "Đăng nhập"}</span>
      </button>
      {open &&
        createPortal(
          <div
            className="modal-backdrop auth-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <section
              ref={dialogRef}
              className="auth-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-title"
            >
              <button
                className="modal-close"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
              >
                <X size={20} aria-hidden="true" />
              </button>
              <span className="auth-icon" aria-hidden="true">
                {user ? <UserRound size={24} /> : <LogIn size={24} />}
              </span>
              <h2 id="auth-title">
                {user ? displayName(user) : "Đăng nhập Dateny"}
              </h2>
              {user ? (
                <>
                  <p>{user.email ?? "Tài khoản mạng xã hội"}</p>
                  <button
                    className="auth-signout"
                    onClick={signOut}
                    disabled={busy}
                  >
                    <LogOut size={18} aria-hidden="true" />
                    Đăng xuất
                  </button>
                </>
              ) : isSupabaseConfigured ? (
                <>
                  <p>Đăng nhập để viết, sửa và lưu ảnh đánh giá quán.</p>
                  <div className="auth-provider-list">
                    <button onClick={() => signIn("google")} disabled={busy}>
                      <span className="provider-mark provider-google">G</span>
                      Tiếp tục với Google
                    </button>
                    <button onClick={() => signIn("facebook")} disabled={busy}>
                      <span className="provider-mark provider-facebook">f</span>
                      Tiếp tục với Facebook
                    </button>
                  </div>
                </>
              ) : (
                <p className="auth-setup-note">
                  Cần cấu hình Supabase trong <code>.env.local</code> để bật
                  đăng nhập.
                </p>
              )}
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
            </section>
          </div>,
          document.querySelector<HTMLElement>(
            ".discovery-page, .discovery-gate",
          ) ?? document.body,
        )}
    </>
  );
}
