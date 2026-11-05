import { automationCaller, bearerToken } from "@/lib/automation/auth";
import { contactListUrlFor } from "@/lib/automation/config";
import { listSheetContacts } from "@/lib/automation/show-contacts";
import { showProjectFor } from "@/lib/openmic/push-server";

const LOAD_FAILED = "Couldn't load the contact list. Try again.";

/**
 * The show's own contact list (the Google Sheet behind the show project's contact-list function) for the recipient
 * picker. Hosts listed in the Automation block only, and only when that block saves a usable `contact_list_url`.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ appSlug: string }> }
) {
  const { appSlug } = await context.params;
  const caller = await automationCaller(appSlug, request);
  if (!caller.ok) return caller.response;

  try {
    const url = await contactListUrlFor(caller.appId);
    if (!url) {
      return Response.json({ error: "This show has no contact list." }, { status: 404 });
    }

    const token = bearerToken(request);
    const project = await showProjectFor(caller.appId);
    const contacts = token && project ? await listSheetContacts(url, project, token) : null;
    if (!contacts) {
      return Response.json({ error: LOAD_FAILED }, { status: 502 });
    }

    return Response.json({ contacts });
  } catch {
    console.error("contact list: load failed");
    return Response.json({ error: LOAD_FAILED }, { status: 502 });
  }
}
