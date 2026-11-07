import { describe, expect, it } from "vitest";
import { createNoHangLock } from "./no-hang-lock";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("noHangLock", () => {
  it("rethrows fn errors and lets the next waiter proceed", async () => {
    const lock = createNoHangLock();
    const error = new Error("boom");
    await expect(lock("x", 0, async () => { throw error; })).rejects.toThrow(error);
    const result = await lock("x", 0, async () => "ok");
    expect(result).toBe("ok");
  });

  it("proceeds after the cap when the holder never settles", async () => {
    const lock = createNoHangLock(20);
    const never = new Promise(() => {});
    lock("x", 0, () => never);
    const start = Date.now();
    const result = await lock("x", 0, async () => "done");
    const elapsed = Date.now() - start;
    expect(result).toBe("done");
    expect(elapsed).toBeGreaterThanOrEqual(15);
    expect(elapsed).toBeLessThan(100);
  });

  it("uses acquireTimeout as the cap when it is smaller than waitMs", async () => {
    const lock = createNoHangLock(5000);
    const never = new Promise(() => {});
    lock("x", 0, () => never);
    const start = Date.now();
    const result = await lock("x", 30, async () => "done");
    const elapsed = Date.now() - start;
    expect(result).toBe("done");
    expect(elapsed).toBeGreaterThanOrEqual(20);
    expect(elapsed).toBeLessThan(100);
  });

  it("treats acquireTimeout -1 and 0 as waitMs", async () => {
    const lock = createNoHangLock(20);
    const never = new Promise(() => {});
    lock("x", 0, () => never);
    let start = Date.now();
    let result = await lock("x", -1, async () => "done");
    let elapsed = Date.now() - start;
    expect(result).toBe("done");
    expect(elapsed).toBeGreaterThanOrEqual(15);
    expect(elapsed).toBeLessThan(100);

    const lock2 = createNoHangLock(20);
    lock2("y", 0, () => never);
    start = Date.now();
    result = await lock2("y", 0, async () => "done");
    elapsed = Date.now() - start;
    expect(result).toBe("done");
    expect(elapsed).toBeGreaterThanOrEqual(15);
    expect(elapsed).toBeLessThan(100);
  });

  it("does not make different names wait on each other", async () => {
    const lock = createNoHangLock(1000);
    const never = new Promise(() => {});
    lock("a", 0, () => never);
    const start = Date.now();
    const result = await lock("b", 0, async () => "b-done");
    const elapsed = Date.now() - start;
    expect(result).toBe("b-done");
    expect(elapsed).toBeLessThan(50);
  });

  it("runs three calls with the same name strictly in order", async () => {
    const lock = createNoHangLock();
    const order: string[] = [];
    const p1 = lock("x", 0, async () => {
      order.push("start1");
      await delay(10);
      order.push("end1");
    });
    const p2 = lock("x", 0, async () => {
      order.push("start2");
      await delay(10);
      order.push("end2");
    });
    const p3 = lock("x", 0, async () => {
      order.push("start3");
      await delay(10);
      order.push("end3");
    });
    await Promise.all([p1, p2, p3]);
    expect(order).toEqual(["start1", "end1", "start2", "end2", "start3", "end3"]);
  });
});
