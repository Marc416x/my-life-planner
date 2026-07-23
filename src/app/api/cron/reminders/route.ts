import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush, SubscriptionGoneError, type PushRow } from "@/lib/push";
import {
  todayISO,
  addDays,
  kindFor,
  prefAllows,
  buildMessage,
  DEFAULT_PREFS,
  PLANNER_LEAD_DAYS,
  OVERDUE_LOOKBACK_DAYS,
  type Prefs,
  type ReminderAssignment,
  type ReminderKind,
} from "@/lib/reminders";

// Always run fresh; never prerender or cache.
export const dynamic = "force-dynamic";

// Daily reminder sweep. Invoked by Vercel Cron (see vercel.json), which sends
// `Authorization: Bearer $CRON_SECRET`. Add `?dry=1` to preview what would be
// sent without sending or logging anything.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const supabase = createAdminClient();
  const today = todayISO();

  // Only assignments inside the window any reminder could care about:
  // from the overdue lookback floor up to the planner-due horizon.
  const { data: rows, error } = await supabase
    .from("assignments")
    .select("id, user_id, title, course, due_date, status")
    .neq("status", "completed")
    .not("due_date", "is", null)
    .gte("due_date", addDays(today, -OVERDUE_LOOKBACK_DAYS))
    .lte("due_date", addDays(today, PLANNER_LEAD_DAYS));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const assignments = (rows ?? []) as ReminderAssignment[];

  // Pair each assignment with the reminder it warrants today (if any).
  const candidates: { a: ReminderAssignment; kind: ReminderKind }[] = [];
  for (const a of assignments) {
    const kind = kindFor(a.due_date, today);
    if (kind) candidates.push({ a, kind });
  }
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, today, considered: 0, sent: 0, dry });
  }

  const userIds = [...new Set(candidates.map((c) => c.a.user_id))];
  const assignmentIds = candidates.map((c) => c.a.id);

  // Preferences (missing row = defaults, i.e. everything on).
  const { data: prefRows } = await supabase
    .from("notification_prefs")
    .select("user_id, enabled, planner_due, due_morning, overdue")
    .in("user_id", userIds);
  const prefsByUser = new Map<string, Prefs>();
  for (const p of prefRows ?? []) {
    const { user_id, ...rest } = p as Prefs & { user_id: string };
    prefsByUser.set(user_id, rest);
  }

  // Already-sent ledger. We dedup on (assignment, kind) regardless of date, so
  // each nudge fires exactly once per assignment even if a run is missed.
  const { data: logRows } = await supabase
    .from("reminder_log")
    .select("assignment_id, kind")
    .in("assignment_id", assignmentIds);
  const alreadySent = new Set(
    (logRows ?? []).map((r) => `${(r as { assignment_id: string }).assignment_id}:${(r as { kind: string }).kind}`),
  );

  const due = candidates.filter(({ a, kind }) => {
    if (alreadySent.has(`${a.id}:${kind}`)) return false;
    return prefAllows(prefsByUser.get(a.user_id) ?? DEFAULT_PREFS, kind);
  });

  if (due.length === 0) {
    return NextResponse.json({ ok: true, today, considered: candidates.length, sent: 0, dry });
  }

  // Devices, grouped by user.
  const { data: subRows } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", [...new Set(due.map((d) => d.a.user_id))]);
  const subsByUser = new Map<string, PushRow[]>();
  for (const s of subRows ?? []) {
    const row = s as PushRow & { user_id: string };
    const list = subsByUser.get(row.user_id) ?? [];
    list.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
    subsByUser.set(row.user_id, list);
  }

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      today,
      considered: candidates.length,
      wouldSend: due.map(({ a, kind }) => ({
        assignment: a.title,
        kind,
        due_date: a.due_date,
        devices: (subsByUser.get(a.user_id) ?? []).length,
      })),
    });
  }

  let sent = 0;
  const dead: string[] = [];
  const logEntries: { user_id: string; assignment_id: string; kind: string; sent_on: string }[] = [];

  for (const { a, kind } of due) {
    const subs = subsByUser.get(a.user_id) ?? [];
    if (subs.length === 0) continue; // no devices — don't log, so it can fire later

    const { title, body } = buildMessage(kind, a);
    let delivered = 0;
    for (const sub of subs) {
      try {
        await sendPush(sub, { title, body, url: "/assignments", tag: `${a.id}:${kind}` });
        delivered++;
      } catch (err) {
        if (err instanceof SubscriptionGoneError) dead.push(err.endpoint);
        else console.error("push failed", err);
      }
    }

    // Only mark it sent if it actually reached a device.
    if (delivered > 0) {
      sent++;
      logEntries.push({ user_id: a.user_id, assignment_id: a.id, kind, sent_on: today });
    }
  }

  if (logEntries.length) {
    await supabase.from("reminder_log").upsert(logEntries, {
      onConflict: "assignment_id,kind,sent_on",
      ignoreDuplicates: true,
    });
  }
  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return NextResponse.json({
    ok: true,
    today,
    considered: candidates.length,
    sent,
    pruned: dead.length,
  });
}
