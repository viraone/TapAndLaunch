import { z } from "zod";

/** A web_page block's config, checked when a page's blocks are saved: https only, with the inspector's own limits. */
export const WebPageBlockConfigSchema = z.object({
  url: z
    .string()
    .max(2000)
    .refine((url) => url === "" || url.startsWith("https://"), "The web address must start with https://"),
  title: z.string().max(120).optional(),
  allow_location: z.boolean().optional(),
  height: z.enum(["screen", "tall", "short"]).optional(),
});
