import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  claimAction,
  errorCodeForSend,
  isDue,
  isRetryableSendFailure,
} from "./due";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function at(offsetMs: number): Date {
  return new Date(NOW.getTime() + offsetMs);
}

describe("isDue", () => {
  it("is due when the window opened in the past and the visit is still ahead", () => {
    expect(isDue({ startsAt: at(2 * HOUR), hoursBefore: 4, now: NOW })).toBe(true);
  });

  it("is not due when the visit is exactly 30 minutes away", () => {
    expect(isDue({ startsAt: at(30 * MINUTE), hoursBefore: 24, now: NOW })).toBe(false);
  });

  it("is due one second after the 30-minute lead ends", () => {
    expect(isDue({ startsAt: at(30 * MINUTE + 1000), hoursBefore: 1, now: NOW })).toBe(true);
  });

  it("is not due one second before the reminder window opens", () => {
    expect(isDue({ startsAt: at(HOUR + 1000), hoursBefore: 1, now: NOW })).toBe(false);
  });

  it("is due exactly when the reminder window opens", () => {
    expect(isDue({ startsAt: at(HOUR), hoursBefore: 1, now: NOW })).toBe(true);
  });

  it("is not due for a visit that already started", () => {
    expect(isDue({ startsAt: at(-MINUTE), hoursBefore: 2, now: NOW })).toBe(false);
  });

  it("is not due for a visit starting exactly now", () => {
    expect(isDue({ startsAt: at(0), hoursBefore: 1, now: NOW })).toBe(false);
  });

  it("is due immediately for a late-booked visit inside its window", () => {
    expect(isDue({ startsAt: at(45 * MINUTE), hoursBefore: 24, now: NOW })).toBe(true);
  });
});

describe("isRetryableSendFailure", () => {
  it.each([0, 403, 429, 500, 502, 599])("treats %i as retryable", (status) => {
    expect(isRetryableSendFailure(status)).toBe(true);
  });

  it.each([200, 301, 400, 401, 402, 404, 418, 600])(
    "treats %i as not retryable",
    (status) => {
      expect(isRetryableSendFailure(status)).toBe(false);
    }
  );
});

describe("claimAction", () => {
  it("claims a visit with no row yet", () => {
    expect(claimAction(null, NOW)).toBe("claim_new");
  });

  it("leaves a sent reminder alone", () => {
    expect(
      claimAction({ status: "sent", attempts: 1, updatedAt: at(-HOUR) }, NOW)
    ).toBe("leave");
  });

  it("leaves a skipped reminder alone", () => {
    expect(
      claimAction({ status: "skipped", attempts: 1, updatedAt: at(-HOUR) }, NOW)
    ).toBe("leave");
  });

  it("retries a failed send once five minutes have passed", () => {
    expect(
      claimAction({ status: "failed", attempts: 1, updatedAt: at(-5 * MINUTE) }, NOW)
    ).toBe("retry");
  });

  it("leaves a failed send that is younger than five minutes", () => {
    expect(
      claimAction(
        { status: "failed", attempts: 1, updatedAt: at(-5 * MINUTE + 1000) },
        NOW
      )
    ).toBe("leave");
  });

  it("retries a failed send with another attempt left", () => {
    expect(
      claimAction(
        { status: "failed", attempts: MAX_ATTEMPTS - 1, updatedAt: at(-6 * MINUTE) },
        NOW
      )
    ).toBe("retry");
  });

  it("gives up on a failed send at the attempt limit", () => {
    expect(
      claimAction(
        { status: "failed", attempts: MAX_ATTEMPTS, updatedAt: at(-HOUR) },
        NOW
      )
    ).toBe("leave");
  });

  it("leaves a recent sending row to the run that owns it", () => {
    expect(
      claimAction({ status: "sending", attempts: 1, updatedAt: at(-MINUTE) }, NOW)
    ).toBe("leave");
  });

  it("leaves even an old sending row; the sender marks it interrupted", () => {
    expect(
      claimAction({ status: "sending", attempts: 1, updatedAt: at(-2 * HOUR) }, NOW)
    ).toBe("leave");
  });
});

describe("errorCodeForSend", () => {
  it.each([403, 429])("calls %i a rate limit", (status) => {
    expect(errorCodeForSend(status)).toBe("rate_limited");
  });

  it.each([0, 400, 401, 404, 500])("calls %i a send failure", (status) => {
    expect(errorCodeForSend(status)).toBe("send_failed");
  });
});
