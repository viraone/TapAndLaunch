import { describe, expect, it } from "vitest";
import { SHEET_SAVE_FAILED, editSheet, editUrlFor } from "./sheet-edit-server";

const SHEET_URL = "https://example.supabase.co/functions/v1/lineup-feed";
const EDIT_URL = "https://example.supabase.co/functions/v1/lineup-edit";

type FetchCall = { url: string; init: Parameters<typeof fetch>[1] };

function captureFetch(respond: () => Response) {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    calls.push({ url: String(input), init });
    return respond();
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function sentBody(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>;
}

describe("editUrlFor", () => {
  it("replaces the final lineup-feed segment", () => {
    expect(editUrlFor(SHEET_URL)).toBe(EDIT_URL);
  });

  it("keeps the query string", () => {
    expect(editUrlFor(`${SHEET_URL}?show=2026-11-20`)).toBe(`${EDIT_URL}?show=2026-11-20`);
  });

  it("refuses a path that does not end in lineup-feed", () => {
    expect(editUrlFor(`${SHEET_URL}/`)).toBeNull();
    expect(editUrlFor("https://example.supabase.co/functions/v1/lineup")).toBeNull();
  });

  it("refuses a string that is not a URL", () => {
    expect(editUrlFor("not a url")).toBeNull();
  });
});

describe("editSheet", () => {
  it("sends an add with position, of and the host row flag", async () => {
    const { calls, fetchImpl } = captureFetch(() => Response.json({ ok: true, text: "Added Sam." }));
    const result = await editSheet({
      lineupUrl: SHEET_URL,
      token: "test-token",
      command: { type: "add", name: "Sam", position: "below", of: "Jeff Morris" },
      hostRow: true,
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, text: "Added Sam." });

    const call = calls[0]!;
    expect(call.url).toBe(EDIT_URL);
    expect(call.init?.method).toBe("POST");
    expect(call.init?.signal).not.toBeUndefined();
    const headers = call.init?.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers.authorization).toBe("Bearer test-token");
    expect(sentBody(call)).toEqual({
      action: "add",
      name: "Sam",
      position: "below",
      of: "Jeff Morris",
      fixed_first_rows: 1,
    });
  });

  it("sends a move with position and of", async () => {
    const { calls, fetchImpl } = captureFetch(() => Response.json({ ok: true, text: "Moved Sam." }));
    await editSheet({
      lineupUrl: SHEET_URL,
      token: "test-token",
      command: { type: "move", name: "Sam", position: "top", of: "Nate Wright" },
      hostRow: false,
      fetchImpl,
    });
    expect(sentBody(calls[0]!)).toEqual({
      action: "move",
      name: "Sam",
      position: "top",
      of: "Nate Wright",
      fixed_first_rows: 0,
    });
  });

  it("sends a swap with other and no position", async () => {
    const { calls, fetchImpl } = captureFetch(() => Response.json({ ok: true, text: "Swapped." }));
    await editSheet({
      lineupUrl: SHEET_URL,
      token: "test-token",
      command: { type: "swap", name: "Nate Wright", other: "Cody Clemens" },
      hostRow: false,
      fetchImpl,
    });
    const body = sentBody(calls[0]!);
    expect(body).toEqual({ action: "swap", name: "Nate Wright", other: "Cody Clemens", fixed_first_rows: 0 });
    expect("position" in body).toBe(false);
  });

  it("passes a refusal sentence through unchanged", async () => {
    const { fetchImpl } = captureFetch(() => Response.json({ ok: false, text: "I couldn't find Jeff." }));
    const result = await editSheet({
      lineupUrl: SHEET_URL,
      token: "test-token",
      command: { type: "add", name: "Sam", position: "end" },
      hostRow: false,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, text: "I couldn't find Jeff." });
  });

  it("asks the host to sign in again on 401 and 403", async () => {
    for (const status of [401, 403]) {
      const { fetchImpl } = captureFetch(() => Response.json({ error: "no" }, { status }));
      const result = await editSheet({
        lineupUrl: SHEET_URL,
        token: "test-token",
        command: { type: "swap", name: "Nate Wright", other: "Cody Clemens" },
        hostRow: false,
        fetchImpl,
      });
      expect(result).toEqual({ ok: false, text: "Sign in again as a host to change the lineup." });
    }
  });

  it("reports a server failure on 500", async () => {
    const { fetchImpl } = captureFetch(() => Response.json({ error: "boom" }, { status: 500 }));
    const result = await editSheet({
      lineupUrl: SHEET_URL,
      token: "test-token",
      command: { type: "add", name: "Sam", position: "end" },
      hostRow: false,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, text: SHEET_SAVE_FAILED });
  });

  it("reports a thrown fetch", async () => {
    const fetchImpl = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const result = await editSheet({
      lineupUrl: SHEET_URL,
      token: "test-token",
      command: { type: "move", name: "Sam", position: "end" },
      hostRow: false,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, text: SHEET_SAVE_FAILED });
  });

  it("reports a 200 with bad JSON", async () => {
    const { fetchImpl } = captureFetch(() => new Response("not json", { status: 200 }));
    const result = await editSheet({
      lineupUrl: SHEET_URL,
      token: "test-token",
      command: { type: "add", name: "Sam", position: "end" },
      hostRow: false,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, text: SHEET_SAVE_FAILED });
  });

  it("says the sheet is not connected when there is no URL", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return Response.json({ ok: true, text: "unused" });
    }) as typeof fetch;
    const result = await editSheet({
      lineupUrl: undefined,
      token: "test-token",
      command: { type: "add", name: "Sam", position: "end" },
      hostRow: false,
      fetchImpl,
    });
    expect(result).toEqual({ ok: false, text: "The sheet isn't connected to this app yet." });
    expect(called).toBe(false);
  });

  it("never puts the token in the returned text", async () => {
    const token = "super-secret-token";
    const badJson = await editSheet({
      lineupUrl: SHEET_URL,
      token,
      command: { type: "add", name: "Sam", position: "end" },
      hostRow: false,
      fetchImpl: captureFetch(() => new Response("no", { status: 200 })).fetchImpl,
    });
    const denied = await editSheet({
      lineupUrl: SHEET_URL,
      token,
      command: { type: "add", name: "Sam", position: "end" },
      hostRow: false,
      fetchImpl: captureFetch(() => Response.json({ error: "no" }, { status: 401 })).fetchImpl,
    });
    expect(badJson.text).not.toContain(token);
    expect(denied.text).not.toContain(token);
  });
});
