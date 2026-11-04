import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appleTouchIconHref } from "./apple-touch-icon";

const mock = vi.hoisted(() => ({
  published: true,
  iconUrl: null as string | null,
}));

vi.mock("@/lib/pwa/data", () => ({
  getPublishedApp: async () =>
    mock.published ? { app: { manifest: { icon_url: mock.iconUrl } } } : null,
}));

import { appleTouchIconResponse } from "@/app/published-apps/[appSlug]/apple-touch-icon-route";

describe("appleTouchIconHref", () => {
  it("links the same-origin proxy when the manifest has an icon", () => {
    expect(appleTouchIconHref("https://cdn.example.com/icon.png")).toBe("/apple-touch-icon.png");
    expect(appleTouchIconHref("/uploads/icon.png")).toBe("/apple-touch-icon.png");
  });

  it("falls back to the generated letter tile when there is no icon", () => {
    expect(appleTouchIconHref(null)).toBe("/app-icon?size=180");
    expect(appleTouchIconHref(undefined)).toBe("/app-icon?size=180");
    expect(appleTouchIconHref("")).toBe("/app-icon?size=180");
  });
});

describe("appleTouchIconResponse", () => {
  beforeEach(() => {
    mock.published = true;
    mock.iconUrl = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a 404 for an unpublished app", async () => {
    mock.published = false;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await appleTouchIconResponse("gone");

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects to the letter tile when the app has no icon", async () => {
    const response = await appleTouchIconResponse("demo");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/app-icon?size=180");
  });

  it("treats an empty icon URL as no icon", async () => {
    mock.iconUrl = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await appleTouchIconResponse("demo");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/app-icon?size=180");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves the uploaded icon's bytes from our own origin", async () => {
    mock.iconUrl = "https://cdn.example.com/icon.png";
    const bytes = new Uint8Array([1, 2, 3]);
    const fetchMock = vi.fn(
      async () => new Response(bytes, { status: 200, headers: { "content-type": "image/webp" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await appleTouchIconResponse("demo");

    expect(fetchMock).toHaveBeenCalledWith(mock.iconUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it("uses image/png when the upstream has no content type", async () => {
    mock.iconUrl = "https://cdn.example.com/icon";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([4]), { status: 200 }))
    );

    const response = await appleTouchIconResponse("demo");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it.each([404, 500])("falls back to the letter tile when the upstream is %i", async (status) => {
    mock.iconUrl = "https://cdn.example.com/icon.png";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status }))
    );

    const response = await appleTouchIconResponse("demo");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/app-icon?size=180");
  });

  it("falls back to the letter tile when the fetch throws", async () => {
    mock.iconUrl = "https://cdn.example.com/icon.png";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      })
    );

    const response = await appleTouchIconResponse("demo");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/app-icon?size=180");
  });
});
