/** Block types that call Google Places (and so cost money per visitor). */
export const MAPS_BLOCK_TYPES: readonly string[] = ["food_directory", "gas_directory"];

export const MAPS_LOCKED_MESSAGE =
  "Live food and Gas prices aren't switched on for your account yet. Contact us to turn them on.";

export function isMapsBlock(type: string): boolean {
  return MAPS_BLOCK_TYPES.includes(type);
}
