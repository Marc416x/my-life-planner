"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Leaf } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email || !password) {
      setError("Please enter an email and password.");
      return;
    }
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function google() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div className="onboard-card">
        <div className="onboard-logo">
          <h1 style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <Leaf size={24} /> MyLifePlanner
          </h1>
          <p>Your Nursing Academic Operating System</p>
        </div>

        <h2>{mode === "signup" ? "Create your account" : "Welcome back, Nurse"}</h2>
        <p>{mode === "signup" ? "Start your nursing academic journey" : "Sign in to your planner"}</p>

        <div className="form-row single">
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="your@email.com"
            />
          </div>
        </div>
        <div className="form-row single">
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder={mode === "signup" ? "Create a password" : "Your password"}
            />
          </div>
        </div>

        {error && (
          <div style={{ color: "var(--terracotta-dark)", fontSize: "0.82rem", marginBottom: "0.5rem" }}>
            {error}
          </div>
        )}

        <button className="btn-primary" onClick={submit} disabled={loading}>
          {loading ? "Please wait…" : mode === "signup" ? "Create Account →" : "Sign In →"}
        </button>
        <button
          className="btn-primary"
          style={{ background: "#fff", color: "#3c4043", border: "1px solid var(--border-strong)", marginTop: "0.6rem" }}
          onClick={google}
        >
          Continue with Google
        </button>

        <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.85rem" }}>
          {mode === "signup" ? "Already have an account? " : "New here? "}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}
            style={{ color: "var(--terracotta)" }}
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </a>
        </p>
      </div>
    </div>
  );
}
