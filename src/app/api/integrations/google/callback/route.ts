import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppEditor } from "@/lib/org";
import { appLiveUrl } from "@/lib/apps/share";
import { getRootDomain } from "@/lib/tenant";
import { isAllowedEmail } from "@/lib/automation/auth";
import { automationEmailsFor } from "@/lib/automation/config";
import { saveConnection } from "@/lib/integrations/google/connection";
import {
  GMAIL_SEND_SCOPE,
  exchangeCode,
  fetchGoogleEmail,
  googleConfig,
  googleRedirectUri,
  revokeToken,
  verifyState,
} from "@/lib/integrations/google/oauth";

const NONCE_COOKIE = "g_oauth_nonce";
const NONCE_PATH = "/api/integrations/google";

function isHttps(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

/** Constant-time comparison for the one-time nonce, so a wrong cookie cannot be guessed a character at a time. */
function nonceMatches(cookieNonce: string, stateNonce: string): boolean {
  if (!cookieNonce || !stateNonce) return false;
  const left = Buffer.from(cookieNonce, "utf8");
  const right = Buffer.from(stateNonce, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Google sends the owner back here. The state is verified before its app id is used, so every redirect goes either to
 * that app's reminders or automation page or to /dashboard — never to an address taken from the query string. The nonce cookie is
 * cleared on every response, whatever the result.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const secure = isHttps(request);

  /** The nonce cookie is cleared on every response, whatever the flow and result. */
  function clearNonce(response: NextResponse): NextResponse {
    response.cookies.set(NONCE_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: NONCE_PATH,
      maxAge: 0,
    });
    return response;
  }

  function finish(path: string): NextResponse {
    return clearNonce(NextResponse.redirect(new URL(path, origin), 302));
  }

  const config = googleConfig();
  if (!config) return finish("/dashboard");

  const stateParam = request.nextUrl.searchParams.get("state");
  const state = stateParam ? verifyState(stateParam, config.keyBase64) : null;
  if (!state) return finish("/dashboard");

  if (state.kind === "openmic") {
    const admin = createAdminClient();
    const { data: app } = await admin
      .from("apps")
      .select("id, slug, custom_domain, custom_domain_status, kind")
      .eq("id", state.appId)
      .maybeSingle();
    if (!app) return finish("/");

    // The only address this flow may end at: the app's own Automation screen.
    const toAutomation = (result: string) =>
      clearNonce(
        NextResponse.redirect(
          new URL(`/automation?gmail=${result}`, appLiveUrl(app, getRootDomain())),
          302
        )
      );

    // Signed in from inside the app, the browser is on another host, so the dashboard's nonce cookie can't come
    // back. The one-time row in google_oauth_states is the nonce instead: consuming it here makes the state
    // unusable a second time.
    const { data: consumed, error: consumeError } = await admin
      .from("google_oauth_states")
      .delete()
      .eq("nonce", state.nonce)
      .eq("app_id", state.appId)
      .gt("expires_at", new Date().toISOString())
      .select("email");
    if (consumeError) {
      console.error("Google OAuth (open mic): could not consume the state");
      return toAutomation("failed");
    }
    const allowedEmail = consumed?.[0]?.email;
    if (!allowedEmail) return toAutomation("failed");

    // The list may have changed since the connect started; the saved block is the authority.
    if (!isAllowedEmail(allowedEmail, await automationEmailsFor(app.id))) {
      return toAutomation("failed");
    }

    const googleError = request.nextUrl.searchParams.get("error");
    if (googleError) {
      return toAutomation(googleError === "access_denied" ? "cancelled" : "failed");
    }

    const code = request.nextUrl.searchParams.get("code");
    if (!code) return toAutomation("failed");

    const exchanged = await exchangeCode({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: googleRedirectUri(origin),
    });
    if (!exchanged.ok) {
      console.error("Google OAuth (open mic): exchange failed");
      return toAutomation("failed");
    }

    const refreshToken = exchanged.refreshToken;
    if (!refreshToken) {
      console.error("Google OAuth (open mic): no refresh token");
      return toAutomation("failed");
    }

    // Same rule as the dashboard flow: without gmail.send there is nothing worth keeping.
    if (!exchanged.scopes.includes(GMAIL_SEND_SCOPE)) {
      await revokeToken(refreshToken);
      return toAutomation("missing_permission");
    }

    const email = await fetchGoogleEmail(exchanged.accessToken);
    if (!email) {
      console.error("Google OAuth (open mic): email unavailable");
      return toAutomation("failed");
    }

    // There is no TapAndLaunch user in this flow, so connected_by stays empty.
    const saved = await saveConnection({
      appId: app.id,
      userId: null,
      email,
      refreshToken,
      scopes: exchanged.scopes,
    });
    if (!saved.ok) {
      console.error("Google OAuth (open mic): save failed");
      return toAutomation("failed");
    }

    return toAutomation("connected");
  }

  // The signed state names the screen to return to; it is never taken from the query string.
  const returnScreen = state.back === "automation" ? "automation" : "reminders";
  const toReminders = (result: string) =>
    finish(`/dashboard/apps/${state.appId}/${returnScreen}?gmail=${result}`);

  const cookieNonce = request.cookies.get(NONCE_COOKIE)?.value ?? "";
  if (!nonceMatches(cookieNonce, state.nonce)) return toReminders("failed");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== state.userId) return toReminders("failed");

  if (!(await isAppEditor(supabase, state.appId))) return toReminders("failed");

  const googleError = request.nextUrl.searchParams.get("error");
  if (googleError) {
    return toReminders(googleError === "access_denied" ? "cancelled" : "failed");
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return toReminders("failed");

  const exchanged = await exchangeCode({
    code,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: googleRedirectUri(origin),
  });
  if (!exchanged.ok) {
    console.error("Google OAuth: exchange failed");
    return toReminders("failed");
  }

  const refreshToken = exchanged.refreshToken;
  if (!refreshToken) {
    console.error("Google OAuth: no refresh token");
    return toReminders("failed");
  }

  // Google lets people untick permissions. Without gmail.send there is nothing worth keeping, so revoke what was
  // just granted and ask them to connect again with the box ticked.
  if (!exchanged.scopes.includes(GMAIL_SEND_SCOPE)) {
    await revokeToken(refreshToken);
    return toReminders("missing_permission");
  }

  const email = await fetchGoogleEmail(exchanged.accessToken);
  if (!email) {
    console.error("Google OAuth: email unavailable");
    return toReminders("failed");
  }

  const saved = await saveConnection({
    appId: state.appId,
    userId: user.id,
    email,
    refreshToken,
    scopes: exchanged.scopes,
  });
  if (!saved.ok) {
    console.error("Google OAuth: save failed");
    return toReminders("failed");
  }

  return toReminders("connected");
}
