"use client";

import { useEffect, useState } from "react";
import {
  Sun,
  Moon,
  Plus,
  ArrowRight,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  CalendarDays,
  HeartPulse,
  Pill,
  TrendingUp,
  Target,
  Sparkles,
  ClipboardList,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { applyMode, getStoredMode, type Mode } from "@/lib/theme";
import { styleClass, STYLE_OPTIONS, type StyleValue } from "@/lib/profile";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  PageHero,
  Progress,
  Section,
  Select,
  StatCard,
  Tabs,
  Textarea,
} from "@/components/kit";

// Colour swatches — proof that every surface routes through a token, so the
// future palette pass is a values-only swap.
const SWATCHES: { name: string; token: string }[] = [
  { name: "Terracotta", token: "--terracotta" },
  { name: "Olive", token: "--olive" },
  { name: "Ochre", token: "--ochre" },
  { name: "Forest", token: "--forest" },
  { name: "Page bg", token: "--bg-main" },
  { name: "Card bg", token: "--bg-card" },
  { name: "Border", token: "--border-strong" },
  { name: "Text", token: "--text-primary" },
];

export default function KitGalleryPage() {
  const [mode, setMode] = useState<Mode>("mode-light");
  const [style, setStyle] = useState<StyleValue>("balanced");
  const [tab, setTab] = useState("overview");
  const [showPw, setShowPw] = useState(false);

  // Reflect the real saved colour mode on load. localStorage is browser-only,
  // so this is read in an effect (not at render) to keep SSR markup stable.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(getStoredMode());
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    applyMode(next);
  }

  return (
    <div className={cn("k-gallery", styleClass(style))}>
      {/* ---- Live controls: appearance + style axes ---- */}
      <div className="k-gallery__controls">
        <div className="k-gallery__control-group">
          <span className="k-gallery__control-label">Mode</span>
          <Button
            size="sm"
            variant={mode === "mode-light" ? "primary" : "ghost"}
            onClick={() => switchMode("mode-light")}
          >
            <Sun size={15} /> Light
          </Button>
          <Button
            size="sm"
            variant={mode === "mode-dark" ? "primary" : "ghost"}
            onClick={() => switchMode("mode-dark")}
          >
            <Moon size={15} /> Dark
          </Button>
        </div>

        <div className="k-gallery__control-group">
          <span className="k-gallery__control-label">Style</span>
          {STYLE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={style === opt.value ? "primary" : "ghost"}
              onClick={() => setStyle(opt.value)}
            >
              {opt.name}
            </Button>
          ))}
        </div>

        <span className="k-gallery__note">
          Reference only — nothing here is wired to live pages.
        </span>
      </div>

      {/* ---- Intro ---- */}
      <PageHero
        title="MyLifePlanner Design Kit"
        subtitle="The login/onboarding finish, packaged as reusable primitives. Colour follows the theme tokens; shape follows the Soft/Bold/Balanced style tokens — flip the switches above and watch everything adapt."
      />

      {/* ---- Page headers ---- */}
      <Section
        title="Page headers"
        description="Standard title block with optional icon + actions, and a warm hero variant."
      >
        <div className="k-stack">
          <Card>
            <PageHeader
              icon={<CalendarDays size={22} />}
              title="Class Schedule"
              subtitle="Every class, exam and clinical shift in one place."
              actions={
                <Button size="sm">
                  <Plus size={16} /> Add class
                </Button>
              }
            />
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Page body content sits here.
            </p>
          </Card>
        </div>
      </Section>

      {/* ---- Buttons ---- */}
      <Section title="Buttons" description="Five variants, three sizes, plus loading and disabled states.">
        <div className="k-stack">
          <div className="k-row">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">
              <Trash2 size={16} /> Delete
            </Button>
          </div>
          <div className="k-row">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">
              Large <ArrowRight size={18} />
            </Button>
            <Button loading>Saving…</Button>
            <Button disabled>Disabled</Button>
            <Button iconOnly variant="outline" aria-label="Edit">
              <Pencil size={16} />
            </Button>
          </div>
        </div>
      </Section>

      {/* ---- Fields ---- */}
      <Section title="Form fields" description="Labelled controls with the login-quality focus ring, hints, and error state.">
        <Card>
          <div className="k-grid-2">
            <Field label="Full name" htmlFor="k-name" hint="As it appears on your records.">
              <Input id="k-name" placeholder="Jane Rivera" />
            </Field>
            <Field label="Program" htmlFor="k-prog">
              <Select id="k-prog" defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                <option>BSN</option>
                <option>ADN</option>
                <option>Accelerated BSN</option>
              </Select>
            </Field>
            <Field label="Password" htmlFor="k-pw" hint="At least 6 characters.">
              <div className="k-inputwrap has-affix">
                <Input
                  id="k-pw"
                  type={showPw ? "text" : "password"}
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  className="k-input-affix"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <Field label="Email" htmlFor="k-email" error="That email address doesn't look right.">
              <Input id="k-email" defaultValue="jane@" />
            </Field>
            <Field label="Notes" htmlFor="k-notes" className="k-grid-span">
              <Textarea id="k-notes" placeholder="Anything worth remembering…" />
            </Field>
          </div>
        </Card>
      </Section>

      {/* ---- Cards + stats ---- */}
      <Section title="Cards & stats" description="Bare, headed, accent and interactive surfaces; stat tiles with tone rails.">
        <div className="k-stack">
          <div className="k-grid-2">
            <Card
              title="With a header"
              subtitle="Icon, title and an action slot."
              icon={<HeartPulse size={20} />}
              action={
                <Button size="sm" variant="ghost">
                  View
                </Button>
              }
            >
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Body content lives below the header.
              </p>
            </Card>
            <Card accent title="Accent card" subtitle="Gradient top bar — the login signature.">
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Great for a highlighted or primary panel.
              </p>
            </Card>
          </div>

          <div className="k-stats-grid">
            <StatCard tone="terracotta" label="Current GPA" value="3.82" sub="+0.06 this term" icon={<TrendingUp size={18} />} />
            <StatCard tone="olive" label="Clinical hours" value="126" sub="of 180 required" icon={<HeartPulse size={18} />} />
            <StatCard tone="ochre" label="NCLEX ready" value="74%" sub="Keep going!" icon={<Target size={18} />} />
            <StatCard tone="forest" label="Drug cards" value="212" sub="mastered" icon={<Pill size={18} />} />
          </div>

          <Card interactive title="Interactive card" icon={<ClipboardList size={20} />}>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Hover me — a subtle lift signals the whole card is clickable.
            </p>
          </Card>

          <Card title="Progress bars">
            <div className="k-stack" style={{ maxWidth: 420 }}>
              <Progress value={72} tone="terracotta" />
              <Progress value={45} tone="olive" />
              <Progress value={88} tone="ochre" />
              <Progress value={30} tone="forest" />
            </div>
          </Card>
        </div>
      </Section>

      {/* ---- Badges ---- */}
      <Section title="Badges" description="Soft (default) and solid, across the palette hues.">
        <div className="k-stack">
          <div className="k-row">
            <Badge tone="terracotta">Terracotta</Badge>
            <Badge tone="olive">Olive</Badge>
            <Badge tone="ochre">Ochre</Badge>
            <Badge tone="forest">Forest</Badge>
            <Badge tone="neutral">Neutral</Badge>
          </div>
          <div className="k-row">
            <Badge solid tone="terracotta">PRO</Badge>
            <Badge solid tone="olive">Passed</Badge>
            <Badge solid tone="ochre">Due soon</Badge>
            <Badge solid tone="forest">Complete</Badge>
          </div>
        </div>
      </Section>

      {/* ---- Alerts ---- */}
      <Section title="Alerts" description="Four tones for inline feedback.">
        <div className="k-stack">
          <Alert tone="success" title="Saved">Your changes were saved.</Alert>
          <Alert tone="error">That email or password doesn&apos;t match. Please try again.</Alert>
          <Alert tone="warning">Your NCLEX exam is 6 weeks away — time to ramp up.</Alert>
          <Alert tone="info">Tip: link a class to auto-fill its subjects on the schedule.</Alert>
        </div>
      </Section>

      {/* ---- Empty state ---- */}
      <Section title="Empty state" description="What a not-yet-operational feature shows until it's wired.">
        <Card flush>
          <EmptyState
            icon={<Rocket size={28} />}
            title="Study Groups are coming"
            description="Team up with classmates, share decks, and quiz each other. This section isn't switched on yet."
            action={
              <Button variant="outline">
                <Sparkles size={16} /> Notify me
              </Button>
            }
          />
        </Card>
      </Section>

      {/* ---- Tabs ---- */}
      <Section title="Tabs" description="Controlled — the page owns the active value.">
        <Tabs
          aria-label="Demo tabs"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "overview", label: "Overview" },
            { value: "subjects", label: "Subjects" },
            { value: "grades", label: "Grades" },
          ]}
        />
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.75rem" }}>
          Active tab: <strong style={{ color: "var(--text-primary)" }}>{tab}</strong>
        </p>
      </Section>

      {/* ---- Tokens ---- */}
      <Section
        title="Colour tokens"
        description="Every component reads these variables — the future palette pass just swaps their values."
      >
        <div className="k-swatches">
          {SWATCHES.map((s) => (
            <div className="k-swatch" key={s.token}>
              <div className="k-swatch__chip" style={{ background: `var(${s.token})` }} />
              <div className="k-swatch__name">
                {s.name}
                <br />
                <code>{s.token}</code>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
