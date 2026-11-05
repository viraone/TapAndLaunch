import { schedulingCaller, sendSchedulingTestEmail } from "@/lib/automation/dashboard";

/** Sends the saved reminder to the connected Gmail address itself, with sample values. */
export async function POST(
  request: Request,
  context: { params: Promise<{ appId: string }> }
) {
  const { appId } = await context.params;
  const caller = await schedulingCaller(appId);
  if (!caller.ok) return caller.response;

  return sendSchedulingTestEmail(appId, caller, request);
}
