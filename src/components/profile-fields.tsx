"use client";

import { useMemo } from "react";
import { Minus, Plus } from "lucide-react";
import {
  GOAL_FIELDS,
  STYLE_OPTIONS,
  YEAR_OPTIONS,
  allTimezones,
  styleClass,
  type ProfileFields,
  type StyleValue,
} from "@/lib/profile";

type GoalKey = (typeof GOAL_FIELDS)[number]["key"];

export function NameField({ value, onChange, id = "pf-name" }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div className="pf-field">
      <label className="pf-label" htmlFor={id}>Display name</label>
      <input
        id={id}
        className="pf-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your name"
        autoComplete="name"
      />
    </div>
  );
}

export function YearField({ value, onChange, id = "pf-year" }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div className="pf-field">
      <label className="pf-label" htmlFor={id}>Nursing year</label>
      <select id={id} className="pf-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}

export function TimezoneField({ value, onChange, id = "pf-tz" }: { value: string; onChange: (v: string) => void; id?: string }) {
  // Keep the stored value selectable even if it isn't in the browser's list.
  const zones = useMemo(() => {
    const list = allTimezones();
    return !value || list.includes(value) ? list : [value, ...list];
  }, [value]);
  return (
    <div className="pf-field">
      <label className="pf-label" htmlFor={id}>Timezone</label>
      <select id={id} className="pf-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {zones.map((z) => (
          <option key={z} value={z}>{z.replace(/_/g, " ")}</option>
        ))}
      </select>
      <span className="pf-hint">Used to send reminders at your local time.</span>
    </div>
  );
}

export function StyleField({ value, onChange }: { value: StyleValue; onChange: (v: StyleValue) => void }) {
  return (
    <div className="pf-style-grid" role="radiogroup" aria-label="Style">
      {STYLE_OPTIONS.map((opt) => (
        <button
          type="button"
          key={opt.value}
          role="radio"
          aria-checked={value === opt.value}
          className={`pf-style-card ${styleClass(opt.value)}${value === opt.value ? " selected" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          <span className="pf-demo" aria-hidden="true">
            <span className="pf-demo-box">
              <span className="pf-demo-line" />
              <span className="pf-demo-line short" />
              <span className="pf-demo-btn" />
            </span>
          </span>
          <span className="pf-style-name">{opt.name}</span>
          <span className="pf-style-tag">{opt.tag}</span>
        </button>
      ))}
    </div>
  );
}

function GoalStepper({
  config,
  value,
  onChange,
}: {
  config: (typeof GOAL_FIELDS)[number];
  value: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(config.max, Math.max(config.min, Number(v.toFixed(1))));
  return (
    <div className="pf-goal-row">
      <span className="pf-label">{config.label}</span>
      <div className="pf-stepper">
        <button
          type="button"
          className="pf-step-btn"
          onClick={() => onChange(clamp(value - config.step))}
          disabled={value <= config.min}
          aria-label={`Decrease ${config.label}`}
        >
          <Minus size={16} />
        </button>
        <span className="pf-step-amount">
          <span className="pf-step-val">{value}</span>
          <span className="pf-step-unit">{config.unit}</span>
        </span>
        <button
          type="button"
          className="pf-step-btn"
          onClick={() => onChange(clamp(value + config.step))}
          disabled={value >= config.max}
          aria-label={`Increase ${config.label}`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export function GoalsFields({
  values,
  onChange,
}: {
  values: Pick<ProfileFields, GoalKey>;
  onChange: (key: GoalKey, value: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
      {GOAL_FIELDS.map((cfg) => (
        <GoalStepper key={cfg.key} config={cfg} value={values[cfg.key]} onChange={(v) => onChange(cfg.key, v)} />
      ))}
    </div>
  );
}
