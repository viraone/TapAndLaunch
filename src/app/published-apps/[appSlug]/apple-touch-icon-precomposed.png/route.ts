import { appleTouchIconResponse } from "../apple-touch-icon-route";

export async function GET(_request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  return appleTouchIconResponse(appSlug);
}
