import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Store (or refresh) a browser's push subscription for the signed-in user.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Malformed subscription" }, { status: 400 });
  }

  // Upsert on endpoint: re-subscribing from the same device just refreshes keys.
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: "endpoint" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Make sure a prefs row exists (master switch on) so the cron picks them up.
  await supabase
    .from("notification_prefs")
    .upsert({ user_id: user.id, enabled: true }, { onConflict: "user_id", ignoreDuplicates: true });

  return NextResponse.json({ ok: true });
}
