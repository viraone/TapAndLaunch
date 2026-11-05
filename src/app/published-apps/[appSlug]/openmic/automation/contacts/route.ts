import { automationCaller, bearerToken } from "@/lib/automation/auth";
import { listShowContacts, mergeContacts } from "@/lib/automation/show-contacts";
import { getAccessToken, getConnectionStatus } from "@/lib/integrations/google/connection";
import { listContacts, type Contact } from "@/lib/integrations/google/people";
import { showProjectFor } from "@/lib/openmic/push-server";

const NO_PERMISSION =
  "Google didn't give permission to read contacts. Connect again and keep every box ticked.";

type GmailLoad = { ok: true; contacts: Contact[] } | { ok: false; response: Response };

/**
 * The owner's Google contacts, plus the show's own comics, for the recipient picker. Hosts listed in the Automation
 * block only. Either source can answer alone: a show with no Gmail connection still lists its comics, and a show
 * whose RPC fails still lists Gmail. Only when both fail does the request fail, with the Gmail answer.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ appSlug: string }> }
) {
  const { appSlug } = await context.params;
  const caller = await automationCaller(appSlug, request);
  if (!caller.ok) return caller.response;

  const [show, gmail] = await Promise.all([
    loadShowContacts(request, caller.appId),
    loadGmailContacts(caller.appId),
  ]);

  if (!show && !gmail.ok) return gmail.response;

  return Response.json({
    contacts: mergeContacts(show ?? [], gmail.ok ? gmail.contacts : []),
    sources: {
      show: show ? show.length : null,
      gmail: gmail.ok ? gmail.contacts.length : null,
    },
  });
}

/** The show's own comics, or null when the caller's token or the app's project is missing or the RPC fails. */
async function loadShowContacts(request: Request, appId: string): Promise<Contact[] | null> {
  try {
    const token = bearerToken(request);
    if (!token) return null;

    const project = await showProjectFor(appId);
    if (!project) return null;

    return await listShowContacts(project, token);
  } catch {
    console.error("automation contacts: show load failed");
    return null;
  }
}

/** The owner's Google contacts, or the same response this route has always given when they cannot be read. */
async function loadGmailContacts(appId: string): Promise<GmailLoad> {
  const token = await getAccessToken(appId);
  if (!token.ok) {
    if (token.reason === "not_connected") {
      return {
        ok: false,
        response: Response.json({ error: "Connect Gmail first." }, { status: 409 }),
      };
    }
    if (token.reason === "reconnect") {
      return {
        ok: false,
        response: Response.json(
          { error: "Your Gmail connection ended. Connect again." },
          { status: 409 }
        ),
      };
    }
    return {
      ok: false,
      response: Response.json(
        { error: "Gmail isn't available right now. Try again." },
        { status: 503 }
      ),
    };
  }

  // The saved scopes already know whether contacts were granted; asking Google would only repeat that. Either list
  // is enough: the owner may have granted only one, and listContacts() returns whichever it can read.
  const gmail = await getConnectionStatus(appId);
  if (!gmail.canReadContacts && !gmail.canReadOtherContacts) {
    return { ok: false, response: Response.json({ error: NO_PERMISSION }, { status: 403 }) };
  }

  const result = await listContacts(token.accessToken);
  if (!result.ok) {
    if (result.reason === "no_permission") {
      return { ok: false, response: Response.json({ error: NO_PERMISSION }, { status: 403 }) };
    }
    return {
      ok: false,
      response: Response.json({ error: "Couldn't load your contacts. Try again." }, { status: 502 }),
    };
  }

  return { ok: true, contacts: result.contacts };
}
