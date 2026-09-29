import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BottomNav } from "@/components/pwa-runtime/BottomNav";

const ITEMS = [
  { label: "Home", icon: "home", page_path: "home" },
  { label: "Submit Your Open Mic", icon: "plus", page_path: "submit" },
  { label: "Halloween Contest", icon: "pumpkin", page_path: "halloween" },
  { label: "Shop", icon: "cart", page_path: "shop" },
];

function render(variant: "compact" | "tabs" | undefined, activePagePath = "home") {
  return renderToStaticMarkup(createElement(BottomNav, { items: ITEMS, variant, activePagePath, onNavigate: () => {} }));
}

describe("BottomNav", () => {
  it("keeps the compact bar by default", () => {
    const html = render(undefined);
    expect(html).toContain('class="flex border-t bg-background"');
    expect(html).not.toContain("fixed");
  });

  it("draws the tabs bar fixed to the bottom, with the active tab marked", () => {
    const html = render("tabs");
    expect(html).toContain("fixed inset-x-0 bottom-0");
    expect(html).toMatch(/aria-current="page"[^>]*text-primary[^>]*>.*?>Home</);
    expect(html.match(/aria-current/g)).toHaveLength(1);
  });

  it("uses StageTime's own icons in the tabs bar, and Beezer's for other names", () => {
    const html = render("tabs");
    expect(html).toContain('d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9Z"');
    expect(html).toContain('d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"');
    expect(html).toContain("m9 11 1.6 1.6");
    expect(html).toContain("lucide-shopping-cart");
  });
});
