import { randomBytes } from "node:crypto";
import { automationCaller } from "@/lib/automation/auth";
import { deleteConnection } from "@/lib/integrations/google/connection";
import {
  buildAuthUrl,
  googleConfig,
  googleRedirectUri,
  signState,
  stateExpiry,
} from "@/lib/integrations/google/oauth";
import { appOrigin } from "@/lib/stripe/checkout";
import { getRootDomain } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";

const NONCE_LIFETIME_MS = 10 * 60_000;

/** http for a local root address, https otherwise — appOrigin()'s rule, plus any host carrying a port. */
function platformProtocol(rootDomain: string): "http" | "https" {
  if (/:\d+$/.test(rootDomain)) return "http";
  return appOrigin("app", rootDomain).startsWith("http://") ? "http" : "https";
}

/**
 * Starts connecting the owner's Gmail from inside the published app. The browser navigates to the returned URL;
 * Google sends it back to the platform's callback, which finishes the flow and returns to the app's Automation tab.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ appSlug: string }> }
) {
  const { appSlug } = await context.params;
  const caller = await automationCaller(appSlug, request);
  if (!caller.ok) return caller.response;

  const config = googleConfig();
  if (!config) {
    return Response.json({ error: "Connecting Gmail isn't available yet." }, { status: 503 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const nonce = randomBytes(32).toString("base64url");

  // Best effort: an expired start can never be used again, so drop this app's leftovers when a new one begins.
  await admin
    .from("google_oauth_states")
    .delete()
    .eq("app_id", caller.appId)
    .lt("expires_at", now.toISOString());

  const { error } = await admin.from("google_oauth_states").insert({
    nonce,
    app_id: caller.appId,
    email: caller.email.trim().toLowerCase(),
    expires_at: new Date(now.getTime() + NONCE_LIFETIME_MS).toISOString(),
  });
  if (error) {
    console.error("Automation connect could not save the state", caller.appId, "state_failed");
    return Response.json({ error: "Could not start connecting Gmail. Try again." }, { status: 500 });
  }

  const state = signState(
    {
      appId: caller.appId,
      userId: caller.userId,
      nonce,
      exp: stateExpiry(now.getTime()),
      kind: "openmic",
    },
    config.keyBase64
  );
  const rootDomain = getRootDomain();
  const redirectUri = googleRedirectUri(`${platformProtocol(rootDomain)}://${rootDomain}`);

  return Response.json({
    url: buildAuthUrl({ clientId: config.clientId, redirectUri, state }),
  });
}

/** Forgets the app's Gmail connection, revoking the grant at Google when it can be reached. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ appSlug: string }> }
) {
  const { appSlug } = await context.params;
  const caller = await automationCaller(appSlug, request);
  if (!caller.ok) return caller.response;

  try {
    await deleteConnection(caller.appId);
  } catch {
    return Response.json({ error: "Could not disconnect. Try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
