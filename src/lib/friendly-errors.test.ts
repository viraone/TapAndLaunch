import { describe, expect, it } from "vitest";
import { NETWORK_ERROR, SERVER_ERROR, friendlyError, isNetworkFailure, isServerFailure } from "./friendly-errors";

describe("friendlyError", () => {
  it("explains a dropped network instead of 'Failed to fetch'", () => {
    expect(friendlyError({ name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 })).toBe(NETWORK_ERROR);
    expect(friendlyError(new TypeError("Failed to fetch"))).toBe(NETWORK_ERROR);
    expect(friendlyError(new TypeError("Load failed"))).toBe(NETWORK_ERROR); // Safari
    expect(friendlyError({ message: "NetworkError when attempting to fetch resource." })).toBe(NETWORK_ERROR); // Firefox
  });

  it("explains a server failure instead of '{}' or an empty message", () => {
    expect(friendlyError({ name: "AuthRetryableFetchError", message: "{}", status: 500 })).toBe(SERVER_ERROR);
    expect(friendlyError({ message: "Internal server error", status: 500 })).toBe(SERVER_ERROR);
    expect(friendlyError({ message: "bad gateway", status: 502 })).toBe(SERVER_ERROR);
    expect(friendlyError({ message: "" })).toBe(SERVER_ERROR);
    expect(friendlyError({ message: "{}" })).toBe(SERVER_ERROR);
    expect(friendlyError({ message: '{"msg":"x"}' })).toBe(SERVER_ERROR);
    expect(friendlyError({ message: "undefined" })).toBe(SERVER_ERROR);
    expect(friendlyError({})).toBe(SERVER_ERROR);
    expect(friendlyError({ name: "AuthRetryableFetchError", message: "upstream", status: 503 })).toBe(SERVER_ERROR);
  });

  it("keeps a message the person can act on", () => {
    expect(friendlyError({ message: "Invalid login credentials", status: 400 })).toBe("Invalid login credentials");
    expect(friendlyError({ message: "User already registered", status: 422 })).toBe("User already registered");
    expect(friendlyError({ message: "Password should be at least 8 characters.", status: 422 })).toBe("Password should be at least 8 characters.");
  });
});

describe("isNetworkFailure / isServerFailure", () => {
  it("treat a missing error as neither", () => {
    expect(isNetworkFailure(null)).toBe(false);
    expect(isServerFailure(undefined)).toBe(false);
  });
  it("tell the two apart", () => {
    expect(isNetworkFailure({ status: 0, message: "x" })).toBe(true);
    expect(isServerFailure({ status: 0, message: "x" })).toBe(false);
    expect(isServerFailure({ status: 500, message: "x" })).toBe(true);
    expect(isNetworkFailure({ status: 500, message: "x" })).toBe(false);
  });
});
