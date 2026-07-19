import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client (Client Components). The anon key is public by
// design — Row-Level Security is what actually protects data. Instantiated
// lazily so nothing breaks at build time before env vars are set.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
