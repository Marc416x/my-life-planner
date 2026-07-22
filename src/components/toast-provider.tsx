"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Toast = { id: number; message: string; actionLabel?: string; onAction?: () => void; duration: number };
type ShowOpts = { actionLabel?: string; onAction?: () => void; duration?: number };
type ToastCtx = { show: (message: string, opts?: ShowOpts) => void };

const Ctx = createContext<ToastCtx>({ show: () => {} });

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [remaining, setRemaining] = useState(Math.ceil(toast.duration / 1000));

  useEffect(() => {
    const start = Date.now();
    const iv = window.setInterval(() => {
      const left = Math.ceil((toast.duration - (Date.now() - start)) / 1000);
      setRemaining(left > 0 ? left : 0);
    }, 250);
    return () => window.clearInterval(iv);
  }, [toast.duration]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        background: "var(--bg-card)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-md)",
        borderRadius: "var(--radius-sm)",
        padding: "0.7rem 0.95rem",
        fontSize: "0.85rem",
        color: "var(--text-primary)",
      }}
    >
      <span>{toast.message}</span>
      {toast.actionLabel && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", minWidth: "2.2ch", textAlign: "right" }}>{remaining}s</span>
          <button
            onClick={() => { toast.onAction?.(); onDismiss(toast.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--terracotta)", fontWeight: 600, fontSize: "0.85rem" }}
          >
            {toast.actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// Minimal app-wide toast. Supports an optional action button (e.g. "Undo") with a live countdown.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, opts?: ShowOpts) => {
      const id = Date.now() + Math.random();
      const duration = opts?.duration ?? 5000;
      setToasts((ts) => [...ts, { id, message, actionLabel: opts?.actionLabel, onAction: opts?.onAction, duration }]);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: "min(92vw, 400px)",
        }}
      >
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
