import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MAX_SHIPPING_RATES, cleanCountries, cleanShippingRates } from "@/lib/store/cart";

const RateSchema = z.object({
  name: z.string().min(1).max(100),
  amount_cents: z.number().int().min(0).max(100_000_00),
  min_days: z.number().int().min(0).max(365).optional(),
  max_days: z.number().int().min(0).max(365).optional(),
});

const StoreSettingsSchema = z.object({
  shipping_enabled: z.boolean().optional(),
  shipping_rates: z.array(RateSchema).max(MAX_SHIPPING_RATES).optional(),
  ship_to_countries: z.array(z.string()).max(250).optional(),
  tax_enabled: z.boolean().optional(),
  promo_codes_enabled: z.boolean().optional(),
});

/**
 * Saves the app's shipping, tax and promo-code choices (an upsert: the row appears the first time
 * anything is changed). RLS (`org editors can write their apps' store settings`, 0046) is the
 * actual authorization check.
 */
export async function PATCH(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = StoreSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const patch = { ...parsed.data };
  if (patch.shipping_rates) patch.shipping_rates = cleanShippingRates(patch.shipping_rates);
  if (patch.ship_to_countries) {
    const countries = cleanCountries(patch.ship_to_countries);
    if (countries.length === 0) return Response.json({ error: "Enter at least one country code, like US." }, { status: 400 });
    patch.ship_to_countries = countries;
  }
  if (patch.shipping_enabled && patch.shipping_rates && patch.shipping_rates.length === 0) {
    return Response.json({ error: "Add at least one shipping rate." }, { status: 400 });
  }

  const { data: settings, error } = await supabase
    .from("store_settings")
    .upsert({ app_id: appId, ...patch }, { onConflict: "app_id" })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ settings });
}
