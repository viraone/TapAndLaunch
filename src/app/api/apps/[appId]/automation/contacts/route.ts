import { loadSchedulingContacts, schedulingCaller } from "@/lib/automation/dashboard";

/** The owner's Google contacts for the recipient picker, read from the app's connected Gmail account. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ appId: string }> }
) {
  const { appId } = await context.params;
  const caller = await schedulingCaller(appId);
  if (!caller.ok) return caller.response;

  return loadSchedulingContacts(appId);
}
