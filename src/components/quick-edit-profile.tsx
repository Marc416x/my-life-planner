"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/profile-provider";
import { DetailSheet } from "@/components/detail-sheet";
import { Button } from "@/components/kit";
import { NameField, YearField, StyleField, GoalsFields } from "@/components/profile-fields";
import {
  DEFAULT_PROFILE_FIELDS,
  loadProfileFields,
  saveProfileFields,
  type ProfileFields,
} from "@/lib/profile";

// Quick-edit profile popup opened from the sidebar user card (the pencil). A
// compact subset of the full Settings profile form — the fields that already
// work — reusing the same load/save path. The full Settings page stays the
// complete version; more fields slot in here later.
export function QuickEditProfile({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const supabase = createClient();
  const { refresh } = useProfile();
  const [userId, setUserId] = useState<string | null>(null);
  const [fields, setFields] = useState<ProfileFields>(DEFAULT_PROFILE_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // (Re)load current values each time the popup opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMsg("");
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setUserId(user?.id ?? null);
      if (user) {
        const f = await loadProfileFields(supabase, user.id);
        if (!cancelled) setFields(f);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = <K extends keyof ProfileFields>(key: K, value: ProfileFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  async function save() {
    if (!userId) return;
    setSaving(true);
    setMsg("");
    const { error } = await saveProfileFields(supabase, userId, fields);
    setSaving(false);
    if (error) {
      setMsg("Couldn't save — try again.");
      return;
    }
    await refresh();
    onOpenChange(false);
  }

  return (
    <DetailSheet open={open} onOpenChange={onOpenChange} title="Edit Profile">
      {loading ? (
        <div style={{ padding: "1rem", fontStyle: "italic", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Loading…
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <NameField value={fields.name} onChange={(v) => update("name", v)} />
          <YearField value={fields.year} onChange={(v) => update("year", v)} />
          <div>
            <div className="pf-label" style={{ marginBottom: "0.5rem" }}>Style</div>
            <StyleField value={fields.style} onChange={(v) => update("style", v)} />
          </div>
          <div>
            <div className="pf-label" style={{ marginBottom: "0.5rem" }}>Goals</div>
            <GoalsFields values={fields} onChange={(k, v) => update(k, v)} />
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            More options (specialty, colour palette…) live in full Settings and are coming here later.
          </div>
          <div className="sheet-actions">
            <Button size="sm" onClick={save} loading={saving}>Save</Button>
            <Button size="sm" variant="outline" className="sheet-action-spacer" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {msg && <span style={{ color: "var(--terracotta-dark)", fontSize: "0.8rem", alignSelf: "center" }}>{msg}</span>}
          </div>
        </div>
      )}
    </DetailSheet>
  );
}
