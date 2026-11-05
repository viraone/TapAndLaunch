import { schedulingCaller, setSchedulingReminderEnabled } from "@/lib/automation/dashboard";

/** Switches one reminder on or off. */
export async function POST(
  request: Request,
  context: { params: Promise<{ appId: string }> }
) {
  const { appId } = await context.params;
  const caller = await schedulingCaller(appId);
  if (!caller.ok) return caller.response;

  return setSchedulingReminderEnabled(appId, request);
}
