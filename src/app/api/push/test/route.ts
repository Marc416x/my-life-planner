import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPush, SubscriptionGoneError, type PushRow } from "@/lib/push";

// Send a test push to every device the signed-in user has registered.
// Lets the user confirm end-to-end delivery from Settings.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: "No devices registered" }, { status: 404 });
  }

  let sent = 0;
  const dead: string[] = [];
  for (const row of subs as PushRow[]) {
    try {
      await sendPush(row, {
        title: "MyLifePlanner",
        body: "🔔 Test notification — reminders are working!",
        url: "/assignments",
        tag: "test",
      });
      sent++;
    } catch (err) {
      if (err instanceof SubscriptionGoneError) dead.push(err.endpoint);
      else throw err;
    }
  }

  // Prune subscriptions the push service reported as gone.
  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return NextResponse.json({ ok: true, sent, pruned: dead.length });
}
