"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, ArrowRight, ArrowLeft, Loader2, Rocket } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/profile-provider";
import {
  DEFAULT_PROFILE_FIELDS,
  STYLE_OPTIONS,
  loadProfileFields,
  saveProfileFields,
  styleClass,
  type ProfileFields,
} from "@/lib/profile";
import { NameField, YearField, StyleField, GoalsFields, TimezoneField } from "@/components/profile-fields";

const STEPS = [0, 1, 2, 3];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { refresh } = useProfile();

  const [fields, setFields] = useState<ProfileFields>(DEFAULT_PROFILE_FIELDS);
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);
      setFields(await loadProfileFields(supabase, user.id));
      setLoading(false);
    })();
  }, [supabase, router]);

  function update<K extends keyof ProfileFields>(key: K, value: ProfileFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  const canContinue = step !== 0 || fields.name.trim().length > 0;
  const styleName = STYLE_OPTIONS.find((o) => o.value === fields.style)?.name ?? "Balanced";

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  }

  async function finish() {
    if (!userId) return;
    setSaving(true);
    setError("");
    const { error } = await saveProfileFields(supabase, userId, fields, { onboarded: true });
    if (error) {
      setError("Couldn't save your setup. Please try again.");
      setSaving(false);
      return;
    }
    await refresh();
    router.replace("/");
  }

  return (
    <div className="ob-page">
      <div className={`ob-card ${styleClass(fields.style)}`}>
        <div className="ob-logo-wrap">
          <span className="ob-logo"><Leaf size={22} /> MyLifePlanner</span>
        </div>
        <div className="ob-steps">
          {STEPS.map((i) => (
            <span key={i} className={"ob-dot" + (i === step ? " active" : i < step ? " done" : "")} />
          ))}
        </div>

        {loading ? (
          <p className="ob-sub" style={{ textAlign: "center", margin: 0 }}>
            <Loader2 size={18} className="auth-spin" style={{ verticalAlign: "-3px" }} /> Loading…
          </p>
        ) : (
          <>
            {step === 0 && (
              <>
                <h2 className="ob-title">Welcome, Nurse</h2>
                <p className="ob-sub">Let&apos;s set up your personal academic space.</p>
                <div className="ob-body">
                  <NameField value={fields.name} onChange={(v) => update("name", v)} />
                  <YearField value={fields.year} onChange={(v) => update("year", v)} />
                  <TimezoneField value={fields.timezone} onChange={(v) => update("timezone", v)} />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="ob-title">Pick your style</h2>
                <p className="ob-sub">This shapes how your planner looks and feels — tap one and the whole card updates instantly.</p>
                <div className="ob-body">
                  <StyleField value={fields.style} onChange={(v) => update("style", v)} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="ob-title">Set your goals</h2>
                <p className="ob-sub">Targets for your streaks and trackers. You can change these anytime in Settings.</p>
                <div className="ob-body">
                  <GoalsFields values={fields} onChange={(k, v) => update(k, v)} />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="ob-title">You&apos;re all set!</h2>
                <p className="ob-sub">Here&apos;s your setup — launch whenever you&apos;re ready.</p>
                <div className="ob-body">
                  <div className="ob-summary">
                    <dl>
                      <dt>Name</dt><dd>{fields.name.trim() || "Student"}</dd>
                      <dt>Year</dt><dd>{fields.year}</dd>
                      <dt>Style</dt><dd>{styleName}</dd>
                      <dt>Study</dt><dd>{fields.daily_goal} / day · {fields.weekly_goal} / week</dd>
                      <dt>Wellness</dt><dd>{fields.sleep_goal} hrs sleep · {fields.water_goal} glasses</dd>
                    </dl>
                  </div>
                  <div className="ob-quote">&ldquo;Caring for others begins with caring for yourself.&rdquo;</div>
                </div>
              </>
            )}

            {error && <div className="ob-alert" style={{ marginTop: "1rem" }}>{error}</div>}

            <div className="ob-nav">
              {step > 0 ? (
                <button type="button" className="ob-btn ob-btn-ghost" onClick={() => setStep(step - 1)} disabled={saving}>
                  <ArrowLeft size={18} /> Back
                </button>
              ) : (
                <span />
              )}
              <button type="button" className="ob-btn ob-btn-primary" onClick={next} disabled={!canContinue || saving}>
                {step < STEPS.length - 1 ? (
                  <>Continue <ArrowRight size={18} /></>
                ) : saving ? (
                  <><Loader2 size={18} className="auth-spin" /> Saving…</>
                ) : (
                  <>Launch MyLifePlanner <Rocket size={18} /></>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
