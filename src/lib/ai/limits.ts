/** Designs one person can ask for in 24 hours. Each costs a little, so this keeps a runaway script or a curious
 * person from running up the bill. Picking a template is not limited. */
export const AI_DAILY_LIMIT = 10;

export const AI_LIMIT_MESSAGE = `You've used today's ${AI_DAILY_LIMIT} designs. Pick a template for now, or try again tomorrow.`;
