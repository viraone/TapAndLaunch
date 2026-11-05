import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "./crypto";
import {
  CONTACTS_OTHER_READONLY_SCOPE,
  CONTACTS_READONLY_SCOPE,
  GMAIL_SEND_SCOPE,
  googleConfig,
  refreshAccessToken,
  revokeToken,
} from "./oauth";

/**
 * The one connected Gmail account per app, and how to get a fresh access token from it.
 *
 * The table has no RLS policies and no grants for anon or authenticated, so it is only reachable through the
 * service-role client here. Every caller must first check that the signed-in person may manage the app
 * (`isAppEditor`); these functions do not do that check themselves.
 */
export interface GoogleConnectionStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  canSend: boolean;
  canReadContacts: boolean;
  /** The people the account has emailed, which Google keeps apart from My Contacts. */
  canReadOtherContacts: boolean;
  needsReconnect: boolean;
}

/** What the reminders card shows. Never includes the token. */
export async function getConnectionStatus(appId: string): Promise<GoogleConnectionStatus> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_connections")
    .select("google_email, scopes, connected_at, last_error")
    .eq("app_id", appId)
    .maybeSingle();

  if (!data) {
    return {
      connected: false,
      email: null,
      connectedAt: null,
      canSend: false,
      canReadContacts: false,
      canReadOtherContacts: false,
      needsReconnect: false,
    };
  }

  return {
    connected: true,
    email: data.google_email,
    connectedAt: data.connected_at,
    canSend: data.scopes.includes(GMAIL_SEND_SCOPE),
    canReadContacts: data.scopes.includes(CONTACTS_READONLY_SCOPE),
    canReadOtherContacts: data.scopes.includes(CONTACTS_OTHER_READONLY_SCOPE),
    needsReconnect: data.last_error === "reconnect",
  };
}

/** Encrypts the refresh token, saves it (replacing an older grant) and clears any previous error. */
export async function saveConnection(input: {
  appId: string;
  /** The TapAndLaunch user who connected it; null for a sign-in started inside a published app. */
  userId: string | null;
  email: string;
  refreshToken: string;
  scopes: string[];
}): Promise<{ ok: boolean }> {
  try {
    const config = googleConfig();
    if (!config) return { ok: false };

    const admin = createAdminClient();
    const { error } = await admin.from("google_connections").upsert(
      {
        app_id: input.appId,
        google_email: input.email,
        refresh_token_enc: encryptSecret(input.refreshToken, config.keyBase64),
        scopes: input.scopes,
        connected_by: input.userId,
        connected_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "app_id" }
    );
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/** Revokes the grant at Google when possible, then forgets the connection. */
export async function deleteConnection(appId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_connections")
    .select("refresh_token_enc")
    .eq("app_id", appId)
    .maybeSingle();

  if (data) {
    const config = googleConfig();
    if (config) {
      try {
        await revokeToken(decryptSecret(data.refresh_token_enc, config.keyBase64));
      } catch {
        // A key that no longer reads the saved token is still no reason to keep the row.
      }
    }
  }

  const { error } = await admin.from("google_connections").delete().eq("app_id", appId);
  if (error) throw new Error("Could not disconnect Gmail");
}

/**
 * A fresh access token for sending mail as the owner.
 *
 * Callers must have already checked that the person may manage the app. When Google says the grant is gone, the row
 * is marked `last_error = "reconnect"` so the dashboard can ask for a new connection; the access token is never
 * stored.
 */
export async function getAccessToken(appId: string): Promise<
  { ok: true; accessToken: string; email: string } | { ok: false; reason: "not_connected" | "reconnect" | "unavailable" }
> {
  const config = googleConfig();
  if (!config) return { ok: false, reason: "unavailable" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("google_connections")
    .select("refresh_token_enc, google_email, last_error")
    .eq("app_id", appId)
    .maybeSingle();

  if (error) return { ok: false, reason: "unavailable" };
  if (!data) return { ok: false, reason: "not_connected" };
  if (data.last_error === "reconnect") return { ok: false, reason: "reconnect" };

  let refreshToken: string;
  try {
    refreshToken = decryptSecret(data.refresh_token_enc, config.keyBase64);
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const refreshed = await refreshAccessToken({
    refreshToken,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });

  if (!refreshed.ok) {
    if (refreshed.reconnect) {
      await admin.from("google_connections").update({ last_error: "reconnect" }).eq("app_id", appId);
      return { ok: false, reason: "reconnect" };
    }
    return { ok: false, reason: "unavailable" };
  }

  return { ok: true, accessToken: refreshed.accessToken, email: data.google_email };
}
