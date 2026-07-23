import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 renamed the "middleware" file convention to "proxy".
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: [
    // Exclude Next internals, static assets, the service worker + manifest
    // (the SW is re-fetched for updates and the manifest loads on the public
    // login page for PWA install), and the reminder cron — it authenticates
    // with CRON_SECRET, not a session, so it must not be bounced to /login.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
