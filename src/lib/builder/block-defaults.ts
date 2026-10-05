import type { BlockConfig, BlockType } from "@/types/database";

export function defaultConfigFor(type: BlockType): BlockConfig {
  switch (type) {
    case "text":
      return { heading: "New heading", body: "" };
    case "image":
      return { src: "", alt: "" };
    case "video":
      return { provider: "youtube", url: "" };
    case "contact_form":
      return {
        title: "Contact us",
        submit_label: "Send",
        fields: [{ name: "email", label: "Email", type: "email", required: true }],
      };
    case "product_list":
      return { title: "Shop" };
    case "event_calendar":
      return { title: "Upcoming events" };
    case "zoom_meeting":
      return { title: "Join our meeting", meeting_url: "" };
    case "canva_embed":
      return {};
    case "listing_directory":
      return { title: "Open mics today", time_zone: "America/Los_Angeles" };
    case "gas_directory":
      return {
        title: "Cheapest gas near me",
        radius_miles: 2,
        fallback_label: "Capitol Hill, Seattle",
        fallback_latitude: 47.6249,
        fallback_longitude: -122.3223,
        default_sort: "price",
        default_grade: "regular",
      };
    case "food_directory":
      return {
        title: "Real-time food near me",
        subtitle: "See what is open right now within 2 miles, and how long until it closes.",
        radius_miles: 2,
        fallback_label: "Capitol Hill, Seattle",
        fallback_latitude: 47.6249,
        fallback_longitude: -122.3223,
        cuisines: [
          "ramen", "vietnamese", "thai", "korean", "taiwanese", "japanese",
          "mexican", "pizza", "burgers", "mediterranean", "ethiopian", "indian", "healthy", "bars", "ice_cream", "dessert",
        ],
        default_sort: "open",
      };
    case "class_finder":
      return {
        title: "FitnessNav",
        subtitle: "Every Pilates, yoga, spin, lifting and climbing class near you, by day.",
        area_label: "Fremont, Seattle",
        area_latitude: 47.651,
        area_longitude: -122.3505,
        class_types: ["pilates", "yoga", "spin", "lifting", "climbing"],
      };
    case "open_mic_signup":
      return {
        title: "Open Mic Sign-Up",
        show_name: "Read The Room",
        venue: "Rickshaw Restaurant & Lounge",
        show_time: "Fridays 7–9 PM",
        supabase_url: "",
        anon_key: "",
        time_zone: "America/Los_Angeles",
        opens_weekday: 5,
        opens_minutes: 21 * 60 + 40,
        closes_weekday: 4,
        closes_minutes: 22 * 60,
      };
  }
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  contact_form: "Contact form",
  product_list: "Product list",
  event_calendar: "Event calendar",
  zoom_meeting: "Zoom meeting",
  canva_embed: "Canva embed",
  listing_directory: "Listing directory",
  gas_directory: "Gas prices",
  food_directory: "Live food",
  open_mic_signup: "Open mic sign-up",
  class_finder: "Fitness classes",
};

export const BLOCK_TYPES: BlockType[] = [
  "text",
  "image",
  "video",
  "contact_form",
  "product_list",
  "event_calendar",
  "zoom_meeting",
  "canva_embed",
  "listing_directory",
  "gas_directory",
  "food_directory",
  "open_mic_signup",
  "class_finder",
];
