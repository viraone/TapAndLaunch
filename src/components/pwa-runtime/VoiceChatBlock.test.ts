import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VoiceChatBlockView } from "./VoiceChatBlock";

describe("VoiceChatBlockView", () => {
  it("shows the title, the greeting and the tap-to-talk button", () => {
    const html = renderToStaticMarkup(createElement(VoiceChatBlockView, { config: { title: "Talk in Lao", greeting: "ສະບາຍດີ" }, live: true }));
    expect(html).toContain("Talk in Lao");
    expect(html).toContain("ສະບາຍດີ");
    expect(html).toContain("Tap to talk");
    expect(html).not.toContain('disabled=""');
  });
  it("draws a fixed state with its turns", () => {
    const html = renderToStaticMarkup(
      createElement(VoiceChatBlockView, {
        config: {},
        live: false,
        initial: {
          phase: "thinking",
          turns: [
            { role: "user", content: "ເຈົ້າຊື່ຫຍັງ" },
            { role: "assistant", content: "ຂ້ອຍແມ່ນຜູ້ຊ່ວຍ" },
          ],
        },
      }),
    );
    expect(html).toContain("ເຈົ້າຊື່ຫຍັງ");
    expect(html).toContain("ຂ້ອຍແມ່ນຜູ້ຊ່ວຍ");
    expect(html).toContain("Thinking");
    expect(html).toContain('disabled=""');
  });
});
