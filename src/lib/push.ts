import webpush from "web-push";

// Configure VAPID once per server instance. Called lazily so a missing key
// throws a clear error at send time rather than at module import.
let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not configured (see .env.example).");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export type PushRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

// A subscription the push service reports as gone — the caller should delete it.
export class SubscriptionGoneError extends Error {
  constructor(public endpoint: string) {
    super("Push subscription is no longer valid");
  }
}

// Send one push. Throws SubscriptionGoneError for 404/410 (expired/unsubscribed)
// so callers can prune the row; other failures rethrow.
export async function sendPush(row: PushRow, payload: PushPayload): Promise<void> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify(payload),
    );
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      throw new SubscriptionGoneError(row.endpoint);
    }
    throw err;
  }
}
