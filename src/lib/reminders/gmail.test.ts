import { afterEach, describe, expect, it, vi } from "vitest";
import { sendViaGmail } from "./gmail";

const URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

function stubFetch(implementation: typeof fetch) {
  const mock = vi.fn(implementation);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendViaGmail", () => {
  it("posts the raw message to Gmail with the token in the Authorization header", async () => {
    const fetchMock = stubFetch(async () =>
      new Response(JSON.stringify({ id: "message_1" }), { status: 200 })
    );

    await expect(sendViaGmail("token_123", "cmF3")).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(URL);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ raw: "cmF3" }));

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token_123");
    expect(headers["Content-Type"]).toBe("application/json");

    // The token must not leak into the URL or the body.
    expect(String(url)).not.toContain("token_123");
    expect(String(init.body)).not.toContain("token_123");
  });

  it("reports a 403 from Gmail", async () => {
    stubFetch(async () => new Response("forbidden", { status: 403 }));

    await expect(sendViaGmail("token_123", "cmF3")).resolves.toEqual({
      ok: false,
      status: 403,
    });
  });

  it("reports any other HTTP failure with its status", async () => {
    stubFetch(async () => new Response("nope", { status: 500 }));

    await expect(sendViaGmail("token_123", "cmF3")).resolves.toEqual({
      ok: false,
      status: 500,
    });
  });

  it("reports a network failure as status 0", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(sendViaGmail("token_123", "cmF3")).resolves.toEqual({
      ok: false,
      status: 0,
    });
  });

  it("passes a 15-second timeout signal", async () => {
    let signal: AbortSignal | undefined;
    stubFetch(async (_url, init) => {
      signal = init?.signal ?? undefined;
      return new Response("", { status: 200 });
    });

    await sendViaGmail("token_123", "cmF3");

    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
  });
});
