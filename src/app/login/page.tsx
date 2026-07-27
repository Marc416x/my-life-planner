"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Leaf,
  Eye,
  EyeOff,
  CalendarDays,
  HeartPulse,
  TrendingUp,
  Pill,
  ArrowRight,
  Loader2,
  MailCheck,
  AlertCircle,
} from "lucide-react";

type Mode = "signup" | "signin";
type Sent = null | "confirm" | "reset";

// Google's multicolour "G" — lucide dropped brand marks, so inline it.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.3 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.2C12.3 13.7 17.7 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.1-3.8 6.5-9.4 6.5-16Z" />
      <path fill="#FBBC05" d="M10.4 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.8l7.9-6.2Z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.1-5.5c-2 1.3-4.5 2.1-8.4 2.1-6.3 0-11.7-4.2-13.6-9.9l-7.9 6.2C6.4 42.6 14.6 48 24 48Z" />
    </svg>
  );
}

// Turn raw Supabase auth errors into something a nursing student can act on.
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email or password doesn't match. Please try again.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — check your inbox for the link.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Try signing in instead.";
  if (m.includes("password should be at least")) return "Your password is too short — use at least 6 characters.";
  if (m.includes("unable to validate email")) return "That email address doesn't look right.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a moment and try again.";
  return message;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Advisory only — this never blocks signup (min length is the sole hard rule).
// Scores on length + character variety; colours are the earthy palette.
const PW_META = [
  { label: "Weak", color: "#C4704A" }, // 1
  { label: "Fair", color: "#C49A3A" }, // 2
  { label: "Good", color: "#6B7C4A" }, // 3
  { label: "Strong", color: "#3E7C55" }, // 4
];
function pwStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let variety = 0;
  if (/[a-z]/.test(pw)) variety++;
  if (/[A-Z]/.test(pw)) variety++;
  if (/\d/.test(pw)) variety++;
  if (/[^A-Za-z0-9]/.test(pw)) variety++;
  let score = 1;
  if (pw.length >= 10) score++;
  if (variety >= 2) score++;
  if (variety >= 3 || pw.length >= 14) score++;
  score = Math.min(score, 4);
  const meta = PW_META[score - 1];
  return { score, label: meta.label, color: meta.color };
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [sent, setSent] = useState<Sent>(null);

  // Surface the failure the OAuth callback bounces back on (?error=auth).
  // One-time read of a browser-only flag on mount — kept in an effect (not a
  // render-time read) so server and client render the same initial markup.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "auth") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("We couldn't finish signing you in. Please try again.");
    }
  }, []);

  // If the visitor already has a session (e.g. opened /login from a bookmark),
  // send them straight to the app instead of showing the form.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setSent(null);
  }

  async function submit() {
    if (!EMAIL_RE.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Your password is too short — use at least 6 characters.");
      return;
    }

    setError("");
    setLoading(true);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (error) {
        setError(friendly(error.message));
        return;
      }
      // With email confirmation on, no session comes back on a fresh signup.
      if (!data.session) {
        // Supabase returns a user with an empty `identities` array when the email
        // is already registered (email-enumeration protection). Surface that
        // instead of the misleading "check your inbox" — nothing was actually sent.
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError("An account with this email already exists — try signing in instead.");
          return;
        }
        setSent("confirm");
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(friendly(error.message));
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function google() {
    setError("");
    setGLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser is already navigating away; only reach here on error.
    if (error) {
      setError(friendly(error.message));
      setGLoading(false);
    }
  }

  async function forgot() {
    if (!EMAIL_RE.test(email)) {
      setError('Enter your email above first, then tap "Forgot password".');
      return;
    }
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    });
    setLoading(false);
    if (error) {
      setError(friendly(error.message));
      return;
    }
    setSent("reset");
  }

  const busy = loading || gLoading;
  const strength = pwStrength(password);

  return (
    <div className="auth-split">
      {/* ---- Brand hero ---- */}
      <aside className="auth-hero">
        <span className="auth-hero__blob b1" />
        <span className="auth-hero__blob b2" />
        <div className="auth-hero__body">
          <span className="auth-hero__brand">
            <Leaf size={26} /> MyLifePlanner
          </span>
          <h1 className="auth-hero__tagline">Your nursing school, all in one calm place.</h1>
          <p className="auth-hero__sub">
            Classes, clinicals, NCLEX prep and your GPA — organized the way nursing students
            actually study.
          </p>
          <ul className="auth-features">
            <li><CalendarDays size={18} /> Plan every class, exam &amp; clinical shift</li>
            <li><HeartPulse size={18} /> Track your NCLEX readiness as you go</li>
            <li><TrendingUp size={18} /> Watch your GPA update in real time</li>
            <li><Pill size={18} /> Drug cards that quiz you back</li>
          </ul>
        </div>
        <p className="auth-hero__quote">
          &ldquo;Caring for others begins with caring for yourself.&rdquo;
        </p>
      </aside>

      {/* ---- Form ---- */}
      <main className="auth-form-side">
        <div className="auth-form-inner">
          {sent ? (
            <div className="auth-sent" role="status" aria-live="polite">
              <span className="auth-sent__icon"><MailCheck size={28} /></span>
              <h2>Check your inbox</h2>
              {sent === "confirm" ? (
                <p>
                  We sent a confirmation link to <strong>{email}</strong>. Click it to activate
                  your account, then come back and sign in.
                </p>
              ) : (
                <p>
                  We sent a password-reset link to <strong>{email}</strong>. Open it to choose a
                  new password.
                </p>
              )}
              <p className="auth-hint">Didn&apos;t get it? Check your spam folder.</p>
              <button
                type="button"
                className="auth-btn auth-btn-primary"
                onClick={() => switchMode("signin")}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h2 className="auth-title">
                {mode === "signup" ? "Create your account" : "Welcome back, Nurse"}
              </h2>
              <p className="auth-subtitle">
                {mode === "signup" ? "Start your nursing academic journey" : "Sign in to your planner"}
              </p>

              {error && (
                <div className="auth-alert auth-alert-error" role="alert" aria-live="assertive">
                  <AlertCircle size={16} /> <span>{error}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <div className="auth-field">
                  <label htmlFor="auth-email">Email address</label>
                  <div className="auth-inputwrap">
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="auth-password">Password</label>
                  <div className="auth-inputwrap has-btn">
                    <input
                      id="auth-password"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "Create a password" : "Your password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
                  {mode === "signup" &&
                    (password ? (
                      <div
                        className="auth-pw-meter"
                        style={{ "--pw-color": strength.color } as React.CSSProperties}
                        aria-live="polite"
                      >
                        <div className="auth-pw-bars" aria-hidden="true">
                          {[1, 2, 3, 4].map((i) => (
                            <span key={i} className={"auth-pw-bar" + (i <= strength.score ? " on" : "")} />
                          ))}
                        </div>
                        <span className="auth-pw-label">{strength.label}</span>
                      </div>
                    ) : (
                      <span className="auth-hint">At least 6 characters.</span>
                    ))}
                </div>

                {mode === "signin" && (
                  <div className="auth-row-end">
                    <button type="button" className="auth-link" onClick={forgot} disabled={busy}>
                      Forgot password?
                    </button>
                  </div>
                )}

                <button type="submit" className="auth-btn auth-btn-primary" disabled={busy}>
                  {loading ? (
                    <>
                      <Loader2 size={18} className="auth-spin" /> Please wait…
                    </>
                  ) : (
                    <>
                      {mode === "signup" ? "Create account" : "Sign in"} <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <div className="auth-divider">or</div>

              <button
                type="button"
                className="auth-btn auth-btn-google"
                onClick={google}
                disabled={busy}
              >
                {gLoading ? <Loader2 size={18} className="auth-spin" /> : <GoogleIcon />}
                Continue with Google
              </button>

              <p className="auth-foot">
                {mode === "signup" ? "Already have an account? " : "New here? "}
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
                >
                  {mode === "signup" ? "Sign in" : "Create one"}
                </button>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
