"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProfileCtx = {
  name: string;
  email: string;
  initials: string;
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<ProfileCtx>({
  name: "",
  email: "",
  initials: "",
  loading: true,
  refresh: async () => {},
});

function computeInitials(name: string, email: string) {
  const source = (name.trim() || email.split("@")[0] || "").trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

// Loads the signed-in user's profile once and shares it app-wide (sidebar name +
// avatar, dashboard greeting). One primary-key lookup per page load, not per component.
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setEmail(user?.email ?? "");
    if (user) {
      const { data } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      setName(data?.name ?? "");
    } else {
      setName("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const initials = computeInitials(name, email);

  return (
    <Ctx.Provider value={{ name, email, initials, loading, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useProfile() {
  return useContext(Ctx);
}
