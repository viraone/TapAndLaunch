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
  }
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  contact_form: "Contact form",
};

export const BLOCK_TYPES: BlockType[] = ["text", "image", "video", "contact_form"];
