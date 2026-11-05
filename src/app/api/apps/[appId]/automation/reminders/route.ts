import {
  deleteSchedulingReminder,
  saveSchedulingReminder,
  schedulingCaller,
} from "@/lib/automation/dashboard";

/** Creates or updates one reminder and replaces its recipient list. */
export async function PUT(
  request: Request,
  context: { params: Promise<{ appId: string }> }
) {
  const { appId } = await context.params;
  const caller = await schedulingCaller(appId);
  if (!caller.ok) return caller.response;

  return saveSchedulingReminder(appId, caller, request);
}

/** Deletes one reminder; its recipients and send log follow by cascade. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ appId: string }> }
) {
  const { appId } = await context.params;
  const caller = await schedulingCaller(appId);
  if (!caller.ok) return caller.response;

  return deleteSchedulingReminder(appId, request);
}
