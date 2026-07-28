"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type GuideTopic = {
  id: string;
  title: string;
  icon?: React.ReactNode;
  body: React.ReactNode;
};

// Expandable "how it works" accordion. One topic open at a time; opening a topic
// smooth-scrolls it into view — the same expand-and-scroll behaviour as the
// Clinicals "Log Session" form. Add future topics by extending the `topics` array.
export function HelpGuide({ topics }: { topics: GuideTopic[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Deep-link support: /help#levels opens (and scrolls to) that topic on load.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hash && topics.some((t) => t.id === hash)) setOpenId(hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!openId) return;
    rowRefs.current.get(openId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openId]);

  return (
    <div className="guide-list">
      {topics.map((t) => {
        const open = openId === t.id;
        return (
          <div
            key={t.id}
            id={t.id}
            className={"guide-item" + (open ? " open" : "")}
            ref={(el) => {
              if (el) rowRefs.current.set(t.id, el);
              else rowRefs.current.delete(t.id);
            }}
            style={{ scrollMarginTop: "1rem" }}
          >
            <button
              type="button"
              className="guide-head"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : t.id)}
            >
              {t.icon && <span className="guide-head-icon">{t.icon}</span>}
              <span className="guide-head-title">{t.title}</span>
              <ChevronDown
                size={18}
                className="guide-chevron"
                style={{ transform: open ? "rotate(180deg)" : "none" }}
              />
            </button>
            {open && <div className="guide-body">{t.body}</div>}
          </div>
        );
      })}
    </div>
  );
}
