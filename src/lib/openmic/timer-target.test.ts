import { describe, expect, it } from "vitest";
import { TIMER_TARGET_KEY, readTimerTarget, targetKeyFor, writeTimerTarget } from "./timer-target";

function fakeStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("timer target", () => {
  it("reads an empty pick when there is no store", () => {
    expect(readTimerTarget(null)).toEqual({ date: "", key: "" });
  });

  it("reads an empty pick when nothing is stored", () => {
    expect(readTimerTarget(fakeStore())).toEqual({ date: "", key: "" });
  });

  it("writes a pick and reads it back", () => {
    const store = fakeStore();
    writeTimerTarget(store, { date: "2026-11-27", key: "april lotshaw" });
    expect(readTimerTarget(store)).toEqual({ date: "2026-11-27", key: "april lotshaw" });
  });

  it("removes the pick when Everyone is chosen", () => {
    const store = fakeStore();
    writeTimerTarget(store, { date: "2026-11-27", key: "april lotshaw" });
    writeTimerTarget(store, { date: "2026-11-27", key: "" });
    expect(store.data.has(TIMER_TARGET_KEY)).toBe(false);
  });

  it("reads an empty pick from a broken value", () => {
    expect(readTimerTarget(fakeStore({ [TIMER_TARGET_KEY]: "{" }))).toEqual({ date: "", key: "" });
  });

  it("reads an empty pick from a value of the wrong shape", () => {
    expect(readTimerTarget(fakeStore({ [TIMER_TARGET_KEY]: "{\"date\":5}" }))).toEqual({ date: "", key: "" });
  });

  it("does not throw when the store refuses to write", () => {
    const store = { getItem: () => null, setItem: () => { throw new Error("full"); }, removeItem: () => {} };
    expect(() => writeTimerTarget(store, { date: "2026-11-27", key: "april lotshaw" })).not.toThrow();
  });

  it("shows the pick only for its own show date", () => {
    expect(targetKeyFor({ date: "2026-11-27", key: "april lotshaw" }, "2026-11-27")).toBe("april lotshaw");
    expect(targetKeyFor({ date: "2026-11-27", key: "april lotshaw" }, "2026-12-04")).toBe("");
  });
});
