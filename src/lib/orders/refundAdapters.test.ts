import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { paymentIntentIdFromInvoice } from "./refundAdapters";

describe("paymentIntentIdFromInvoice", () => {
  it("returns the payment intent named by an invoice payment", () => {
    expect(
      paymentIntentIdFromInvoice({
        payments: {
          data: [
            { payment: { type: "charge", charge: "ch_1" } },
            { payment: { type: "payment_intent", payment_intent: "pi_1" } },
          ],
        },
      })
    ).toBe("pi_1");
  });

  it("accepts an expanded payment intent object", () => {
    expect(
      paymentIntentIdFromInvoice({
        payments: { data: [{ payment: { type: "payment_intent", payment_intent: { id: "pi_2" } } }] },
      })
    ).toBe("pi_2");
  });

  it("skips entries with no payment intent and keeps looking", () => {
    expect(
      paymentIntentIdFromInvoice({
        payments: {
          data: [
            { payment: { type: "payment_intent", payment_intent: null } },
            { payment: { type: "payment_record", payment_record: "pr_1" } },
            { payment: { type: "payment_intent", payment_intent: "pi_3" } },
          ],
        },
      })
    ).toBe("pi_3");
  });

  it("uses the first payment intent when there is more than one", () => {
    expect(
      paymentIntentIdFromInvoice({
        payments: {
          data: [
            { payment: { type: "payment_intent", payment_intent: "pi_first" } },
            { payment: { type: "payment_intent", payment_intent: "pi_second" } },
          ],
        },
      })
    ).toBe("pi_first");
  });

  it.each([
    [null],
    [undefined],
    [{}],
    [{ payments: null }],
    [{ payments: { data: null } }],
    [{ payments: { data: [] } }],
    [{ payments: { data: [{ payment: { type: "charge", charge: "ch_1" } }] } }],
    [{ payments: { data: [{ payment: null }] } }],
  ])("returns null for %j", (invoice) => {
    expect(paymentIntentIdFromInvoice(invoice as never)).toBeNull();
  });
});
