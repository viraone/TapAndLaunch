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
];
