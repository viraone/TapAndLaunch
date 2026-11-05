import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import {
  buildAuthUrl,
  googleConfig,
  googleRedirectUri,
  signState,
  stateExpiry,
} from "@/lib/integrations/google/oauth";

const NONCE_COOKIE = "g_oauth_nonce";
const NONCE_PATH = "/api/integrations/google";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isHttps(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

/**
 * Begins connecting the owner's Gmail: checks who is asking, plants a one-time nonce cookie, and sends the browser
 * to Google with a short-lived signed state. Nothing is saved until the callback succeeds.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin), 302);

  const appId = request.nextUrl.searchParams.get("app") ?? "";
  if (!UUID_PATTERN.test(appId)) return NextResponse.redirect(new URL("/dashboard", origin), 302);
  if (!(await isAppEditor(supabase, appId))) {
    return NextResponse.redirect(new URL("/dashboard", origin), 302);
  }

  // Only the two known screens can be returned to; anything else means Reminders.
  const back = request.nextUrl.searchParams.get("back") === "automation" ? "automation" : undefined;

  const config = googleConfig();
  if (!config) {
    return NextResponse.redirect(
      new URL(`/dashboard/apps/${appId}/${back ?? "reminders"}?gmail=unavailable`, origin),
      302
    );
  }

  const nonce = randomBytes(32).toString("base64url");
  const state = signState(
    { appId, userId: user.id, nonce, exp: stateExpiry(), ...(back ? { back } : {}) },
    config.keyBase64
  );
  const authUrl = buildAuthUrl({
    clientId: config.clientId,
    redirectUri: googleRedirectUri(origin),
    state,
  });

  const response = NextResponse.redirect(authUrl, 302);
  response.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(request),
    path: NONCE_PATH,
    maxAge: 600,
  });
  return response;
}
