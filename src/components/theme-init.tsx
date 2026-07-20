"use client";

import { useEffect } from "react";
import { applyMode, getStoredMode } from "@/lib/theme";

// Applies the saved colour mode on load, on every page.
export function ThemeInit() {
  useEffect(() => {
    applyMode(getStoredMode());
  }, []);
  return null;
}
