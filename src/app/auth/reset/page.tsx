"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Leaf, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// Landing page for the password-reset email link. The /auth/callback route
// exchanges the recovery code for a session and redirects here (?next=/auth/reset),
// so by the time this renders the user should have a recovery session.
type Status = "checking" | "ready" | "no-session" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "ready" : "no-session");
    });
  }, []);

  async function save() {
    if (password.length < 6) {
      setError("Your new password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setError("");
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStatus("done");
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1400);
  }

  return (
    <div className="auth-center">
      <div className="auth-card">
        <div className="auth-brand-center">
          <span className="auth-hero__brand">
            <Leaf size={24} /> MyLifePlanner
          </span>
        </div>

        {status === "checking" && (
          <p className="auth-subtitle" style={{ textAlign: "center", marginBottom: 0 }}>
            <Loader2 size={18} className="auth-spin" style={{ verticalAlign: "-3px" }} /> Checking your link…
          </p>
        )}

        {status === "no-session" && (
          <div className="auth-sent">
            <span className="auth-sent__icon" style={{ color: "var(--terracotta-dark)", background: "color-mix(in srgb, var(--terracotta) 14%, transparent)" }}>
              <AlertCircle size={28} />
            </span>
            <h2>Link expired</h2>
            <p>This password-reset link is invalid or has expired. Request a fresh one from the sign-in page.</p>
            <button type="button" className="auth-btn auth-btn-primary" onClick={() => router.push("/login")}>
              Back to sign in
            </button>
          </div>
        )}

        {status === "done" && (
          <div className="auth-sent">
            <span className="auth-sent__icon"><CheckCircle2 size={28} /></span>
            <h2>Password updated</h2>
            <p>You&apos;re all set — taking you to your planner…</p>
          </div>
        )}

        {status === "ready" && (
          <>
            <h2 className="auth-title" style={{ textAlign: "center" }}>Choose a new password</h2>
            <p className="auth-subtitle" style={{ textAlign: "center" }}>Make it at least 6 characters.</p>

            {error && (
              <div className="auth-alert auth-alert-error" role="alert" aria-live="assertive">
                <AlertCircle size={16} /> <span>{error}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="auth-field">
                <label htmlFor="reset-pw">New password</label>
                <div className="auth-inputwrap has-btn">
                  <input
                    id="reset-pw"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password"
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="auth-pw-toggle"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="reset-confirm">Confirm password</label>
                <div className="auth-inputwrap">
                  <input
                    id="reset-confirm"
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button type="submit" className="auth-btn auth-btn-primary" disabled={saving} style={{ marginTop: "0.3rem" }}>
                {saving ? (
                  <>
                    <Loader2 size={18} className="auth-spin" /> Saving…
                  </>
                ) : (
                  <>
                    Update password <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
