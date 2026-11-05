import { automationCaller } from "@/lib/automation/auth";
import { getAccessToken, getConnectionStatus } from "@/lib/integrations/google/connection";
import { listContacts } from "@/lib/integrations/google/people";

const NO_PERMISSION =
  "Google didn't give permission to read contacts. Connect again and keep every box ticked.";

/**
 * The owner's Google contacts for the recipient picker, read from the account the app has connected. Hosts listed in
 * the Automation block only.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ appSlug: string }> }
) {
  const { appSlug } = await context.params;
  const caller = await automationCaller(appSlug, request);
  if (!caller.ok) return caller.response;

  const token = await getAccessToken(caller.appId);
  if (!token.ok) {
    if (token.reason === "not_connected") {
      return Response.json({ error: "Connect Gmail first." }, { status: 409 });
    }
    if (token.reason === "reconnect") {
      return Response.json(
        { error: "Your Gmail connection ended. Connect again." },
        { status: 409 }
      );
    }
    return Response.json(
      { error: "Gmail isn't available right now. Try again." },
      { status: 503 }
    );
  }

  // The saved scopes already know whether contacts were granted; asking Google would only repeat that.
  const gmail = await getConnectionStatus(caller.appId);
  if (!gmail.canReadContacts) {
    return Response.json({ error: NO_PERMISSION }, { status: 403 });
  }

  const result = await listContacts(token.accessToken);
  if (!result.ok) {
    if (result.reason === "no_permission") {
      return Response.json({ error: NO_PERMISSION }, { status: 403 });
    }
    return Response.json({ error: "Couldn't load your contacts. Try again." }, { status: 502 });
  }

  return Response.json({ contacts: result.contacts });
}
