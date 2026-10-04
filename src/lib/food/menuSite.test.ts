import { describe, expect, it } from "vitest";
import { embeddableFromHeaders, findMenuLink, isPrivateAddress, normalizeWebUrl } from "@/lib/food/menuSite";

describe("embeddableFromHeaders", () => {
  it("allows a site that sets nothing", () => {
    expect(embeddableFromHeaders({})).toBe(true);
    expect(embeddableFromHeaders({ "content-security-policy": "default-src 'self'; img-src *" })).toBe(true);
  });
  it("refuses any X-Frame-Options", () => {
    expect(embeddableFromHeaders({ "x-frame-options": "SAMEORIGIN" })).toBe(false);
    expect(embeddableFromHeaders({ "x-frame-options": "deny" })).toBe(false);
  });
  it("reads frame-ancestors", () => {
    expect(embeddableFromHeaders({ "content-security-policy": "frame-ancestors 'none'" })).toBe(false);
    expect(embeddableFromHeaders({ "content-security-policy": "default-src 'self'; frame-ancestors 'self'" })).toBe(false);
    expect(embeddableFromHeaders({ "content-security-policy": "frame-ancestors https://other.example.com" })).toBe(false);
    expect(embeddableFromHeaders({ "content-security-policy": "frame-ancestors *" })).toBe(true);
    expect(embeddableFromHeaders({ "content-security-policy": "frame-ancestors https://*.tapandlaunch.com" })).toBe(true);
  });
});

describe("normalizeWebUrl", () => {
  it("accepts plain web URLs and resolves relative ones", () => {
    expect(normalizeWebUrl("https://a.example.com/menu#top")?.toString()).toBe("https://a.example.com/menu");
    expect(normalizeWebUrl("/menu", "https://a.example.com/x")?.toString()).toBe("https://a.example.com/menu");
  });
  it("rejects other schemes, odd ports and credentials", () => {
    expect(normalizeWebUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeWebUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeWebUrl("http://a.example.com:8080/")).toBeNull();
    expect(normalizeWebUrl("https://user:pw@a.example.com/")).toBeNull();
    expect(normalizeWebUrl("nonsense")).toBeNull();
  });
});

describe("isPrivateAddress (server-side request safety)", () => {
  it("blocks internal addresses", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.1.2.3", "224.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "93.184.216.34", "172.32.0.1", "100.63.0.1", "2606:4700:4700::1111"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
  it("refuses things that aren't addresses", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});

describe("findMenuLink", () => {
  const base = "https://phoan.example.com/";
  it("prefers a link whose text is Menu", () => {
    const html = `<a href="/about">About</a><a href="/order-online">Order our menu online</a><a href="/our-menu">Menu</a>`;
    expect(findMenuLink(html, base)).toBe("https://phoan.example.com/our-menu");
  });
  it("falls back to text containing menu, then a /menu path", () => {
    expect(findMenuLink(`<a href="/food">See Dinner Menu</a>`, base)).toBe("https://phoan.example.com/food");
    expect(findMenuLink(`<a href="/menu/dinner">Eat</a>`, base)).toBe("https://phoan.example.com/menu/dinner");
  });
  it("ignores navigation toggles, anchors, scripts and file links", () => {
    expect(findMenuLink(`<a class="menu-toggle" href="/x">Menu</a>`, base)).toBeNull();
    expect(findMenuLink(`<a href="#">Menu</a><a href="javascript:void(0)">Menu</a>`, base)).toBeNull();
    expect(findMenuLink(`<a href="/menu.pdf">Menu</a>`, base)).toBeNull();
  });
  it("returns null when there is no menu link", () => {
    expect(findMenuLink(`<a href="/contact">Contact</a>`, base)).toBeNull();
  });
});
