import { loadSchedulingState, schedulingCaller } from "@/lib/automation/dashboard";

/** The dashboard's Automation screen: the Gmail connection, the app's reminders, its customers and the defaults. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ appId: string }> }
) {
  const { appId } = await context.params;
  const caller = await schedulingCaller(appId);
  if (!caller.ok) return caller.response;

  return loadSchedulingState(appId, caller);
}
