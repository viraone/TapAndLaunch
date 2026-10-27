import { describe, expect, it } from "vitest";
import type { Lookup } from "seositetuneup";
import { validateSite } from "./validate";

const PRIVATE_MESSAGE = "I can only check sites on the public internet — not local or private addresses.";

/** A fake resolver that never touches real DNS. */
const lookup = (addresses: string[]): Lookup => async () => addresses.map((address) => ({ address, family: 4 }));

describe("validateSite", () => {
  it("normalises a bare name and strips www from the host", async () => {
    expect(await validateSite("  Example.com  ", lookup(["93.184.216.34"]))).toEqual({
      ok: true,
      site: "https://example.com/",
      host: "example.com",
    });
  });

  it("keeps the path and the scheme it was given", async () => {
    expect(await validateSite("https://WWW.Example.com/about", lookup(["93.184.216.34"]))).toEqual({
      ok: true,
      site: "https://www.example.com/about",
      host: "example.com",
    });
  });

  it("refuses an empty address", async () => {
    expect(await validateSite("   ", lookup([]))).toEqual({ ok: false, message: "Enter a website address to check." });
  });

  it("refuses an over-long address", async () => {
    expect(await validateSite("a".repeat(201) + ".com", lookup([]))).toEqual({ ok: false, message: "That address is too long to check." });
  });

  it("refuses a non-http scheme", async () => {
    expect(await validateSite("ftp://example.com", lookup([]))).toEqual({
      ok: false,
      message: "I can only check http:// and https:// addresses.",
    });
  });

  it("refuses a username or password", async () => {
    expect(await validateSite("https://user:pass@example.com", lookup([]))).toEqual({
      ok: false,
      message: "I can only check a plain address — no username or password.",
    });
  });

  it("refuses a custom port", async () => {
    expect(await validateSite("https://example.com:8443", lookup([]))).toEqual({
      ok: false,
      message: "I can only check the usual web ports, not a custom one.",
    });
  });

  it("refuses tapandlaunch.com and its subdomains", async () => {
    expect(await validateSite("tapandlaunch.com", lookup([]))).toEqual({
      ok: false,
      message: "That's us — check a site outside tapandlaunch.com instead.",
    });
    expect(await validateSite("https://app.tapandlaunch.com", lookup([]))).toEqual({
      ok: false,
      message: "That's us — check a site outside tapandlaunch.com instead.",
    });
  });

  it("refuses a name that resolves to a private address", async () => {
    expect(await validateSite("example.com", lookup(["10.0.0.5"]))).toEqual({ ok: false, message: PRIVATE_MESSAGE });
  });

  it("refuses localhost and bare private IPs without asking DNS", async () => {
    expect(await validateSite("localhost", lookup([]))).toEqual({ ok: false, message: PRIVATE_MESSAGE });
    expect(await validateSite("http://192.168.1.5", lookup([]))).toEqual({ ok: false, message: PRIVATE_MESSAGE });
  });

  it("proceeds when the name does not resolve, so the audit can report it unreachable", async () => {
    const throwing: Lookup = async () => {
      throw new Error("ENOTFOUND");
    };
    expect(await validateSite("does-not-exist.example", throwing)).toEqual({
      ok: true,
      site: "https://does-not-exist.example/",
      host: "does-not-exist.example",
    });
  });
});
