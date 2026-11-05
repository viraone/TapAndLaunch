import { describe, expect, it } from "vitest";
import {
  VISIT_STATUSES,
  isVisitStatus,
  parseCustomerInput,
  parseVisitInput,
} from "./validate";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

const VALID_VISIT = {
  customer_id: UUID,
  date: "2026-11-03",
  time: "10:00",
  duration_minutes: 120,
};

function expectCustomerOk(body: unknown) {
  const result = parseCustomerInput(body);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function expectCustomerError(body: unknown, error: string) {
  const result = parseCustomerInput(body);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected an error");
  expect(result.error).toBe(error);
}

function expectVisitOk(body: unknown) {
  const result = parseVisitInput(body);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function expectVisitError(body: unknown, error: string) {
  const result = parseVisitInput(body);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected an error");
  expect(result.error).toBe(error);
}

describe("parseCustomerInput", () => {
  it("trims the name and the optional text fields and lower-cases the email", () => {
    const value = expectCustomerOk({
      name: "  Jane Doe  ",
      email: "  Jane@Example.COM ",
      phone: " 555-0100 ",
      address: " 12 Main St ",
      entry_notes: " Gate 1234 ",
      notes: " Likes the cat ",
    });

    expect(value).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "555-0100",
      address: "12 Main St",
      entry_notes: "Gate 1234",
      notes: "Likes the cat",
    });
  });

  it("turns empty optional fields into null", () => {
    const value = expectCustomerOk({
      name: "Jane",
      email: "",
      phone: "   ",
      address: null,
      entry_notes: "",
      notes: undefined,
    });

    expect(value).toEqual({
      name: "Jane",
      email: null,
      phone: null,
      address: null,
      entry_notes: null,
      notes: null,
    });
  });

  it("treats missing optional fields as null", () => {
    const value = expectCustomerOk({ name: "Jane" });

    expect(value).toEqual({
      name: "Jane",
      email: null,
      phone: null,
      address: null,
      entry_notes: null,
      notes: null,
    });
  });

  it("requires a name", () => {
    expectCustomerError({}, "Enter a name.");
    expectCustomerError({ name: "   " }, "Enter a name.");
    expectCustomerError({ name: 123 }, "Enter a name.");
  });

  it("allows 120 name characters and rejects more", () => {
    expect(expectCustomerOk({ name: "a".repeat(120) }).name).toBe(
      "a".repeat(120)
    );
    expectCustomerError(
      { name: "a".repeat(121) },
      "Name must be 120 characters or fewer."
    );
  });

  it("rejects an email that does not look like an email", () => {
    expectCustomerError(
      { name: "Jane", email: "not-an-email" },
      "Enter a valid email address."
    );
    expectCustomerError(
      { name: "Jane", email: "jane@example" },
      "Enter a valid email address."
    );
    expectCustomerError(
      { name: "Jane", email: 123 },
      "Enter a valid email address."
    );
  });

  it("enforces the optional field length limits", () => {
    expectCustomerError(
      { name: "Jane", phone: "1".repeat(501) },
      "Phone must be 500 characters or fewer."
    );
    expectCustomerError(
      { name: "Jane", address: "1".repeat(501) },
      "Address must be 500 characters or fewer."
    );
    expectCustomerError(
      { name: "Jane", entry_notes: "1".repeat(2001) },
      "Entry notes must be 2000 characters or fewer."
    );
    expectCustomerError(
      { name: "Jane", notes: "1".repeat(2001) },
      "Notes must be 2000 characters or fewer."
    );

    const value = expectCustomerOk({
      name: "Jane",
      phone: "1".repeat(500),
      address: "1".repeat(500),
      entry_notes: "1".repeat(2000),
      notes: "1".repeat(2000),
    });
    expect(value.phone).toHaveLength(500);
    expect(value.notes).toHaveLength(2000);
  });

  it("rejects non-string optional fields", () => {
    expectCustomerError(
      { name: "Jane", phone: 123 },
      "Phone is not valid."
    );
    expectCustomerError({ name: "Jane", notes: [] }, "Notes is not valid.");
  });

  it("rejects a body that is not an object", () => {
    expectCustomerError(null, "Could not read the customer details.");
    expectCustomerError([], "Could not read the customer details.");
    expectCustomerError("nope", "Could not read the customer details.");
  });
});

describe("parseVisitInput", () => {
  it("accepts a minimal visit and fills optional fields with null", () => {
    const value = expectVisitOk(VALID_VISIT);

    expect(value).toEqual({
      customer_id: UUID,
      date: "2026-11-03",
      time: "10:00",
      duration_minutes: 120,
      service: null,
      notes: null,
      repeat_every_weeks: null,
      repeat_until: null,
    });
  });

  it("trims service and notes", () => {
    const value = expectVisitOk({
      ...VALID_VISIT,
      service: "  Deep clean ",
      notes: "  Use the side door ",
    });

    expect(value.service).toBe("Deep clean");
    expect(value.notes).toBe("Use the side door");
  });

  it("requires a customer uuid", () => {
    expectVisitError(
      { ...VALID_VISIT, customer_id: undefined },
      "Choose a customer."
    );
    expectVisitError({ ...VALID_VISIT, customer_id: "abc" }, "Choose a customer.");
    expect(
      expectVisitOk({ ...VALID_VISIT, customer_id: UUID.toUpperCase() })
        .customer_id
    ).toBe(UUID.toUpperCase());
  });

  it("requires a real calendar date", () => {
    expectVisitError(
      { ...VALID_VISIT, date: "2026-02-30" },
      "Enter a valid date."
    );
    expectVisitError(
      { ...VALID_VISIT, date: "2026-13-01" },
      "Enter a valid date."
    );
    expectVisitError({ ...VALID_VISIT, date: "2026-2-3" }, "Enter a valid date.");
    expectVisitError({ ...VALID_VISIT, date: undefined }, "Enter a valid date.");
  });

  it("requires a 24-hour HH:MM time", () => {
    expect(expectVisitOk({ ...VALID_VISIT, time: "00:00" }).time).toBe("00:00");
    expect(expectVisitOk({ ...VALID_VISIT, time: "23:59" }).time).toBe("23:59");
    expectVisitError({ ...VALID_VISIT, time: "24:00" }, "Enter a valid time.");
    expectVisitError({ ...VALID_VISIT, time: "9:00" }, "Enter a valid time.");
    expectVisitError({ ...VALID_VISIT, time: "10:60" }, "Enter a valid time.");
    expectVisitError({ ...VALID_VISIT, time: "10:00:00" }, "Enter a valid time.");
  });

  it("requires a whole duration between 15 and 720 minutes", () => {
    expect(
      expectVisitOk({ ...VALID_VISIT, duration_minutes: 15 }).duration_minutes
    ).toBe(15);
    expect(
      expectVisitOk({ ...VALID_VISIT, duration_minutes: 720 }).duration_minutes
    ).toBe(720);
    expectVisitError(
      { ...VALID_VISIT, duration_minutes: 14 },
      "Duration must be between 15 and 720 minutes."
    );
    expectVisitError(
      { ...VALID_VISIT, duration_minutes: 721 },
      "Duration must be between 15 and 720 minutes."
    );
    expectVisitError(
      { ...VALID_VISIT, duration_minutes: 120.5 },
      "Duration must be between 15 and 720 minutes."
    );
    expectVisitError(
      { ...VALID_VISIT, duration_minutes: "120" },
      "Duration must be between 15 and 720 minutes."
    );
  });

  it("allows a repeat of 1 to 12 whole weeks", () => {
    expect(
      expectVisitOk({ ...VALID_VISIT, repeat_every_weeks: 1 })
        .repeat_every_weeks
    ).toBe(1);
    expect(
      expectVisitOk({ ...VALID_VISIT, repeat_every_weeks: 12 })
        .repeat_every_weeks
    ).toBe(12);
    expect(
      expectVisitOk({ ...VALID_VISIT, repeat_every_weeks: null })
        .repeat_every_weeks
    ).toBeNull();

    for (const repeat of [0, 13, 2.5, "2"]) {
      expectVisitError(
        { ...VALID_VISIT, repeat_every_weeks: repeat },
        "Repeat must be every 1 to 12 weeks."
      );
    }
  });

  it("validates the repeat end date when a repeat is set", () => {
    const value = expectVisitOk({
      ...VALID_VISIT,
      repeat_every_weeks: 2,
      repeat_until: "2027-03-01",
    });
    expect(value.repeat_until).toBe("2027-03-01");

    expect(
      expectVisitOk({
        ...VALID_VISIT,
        repeat_every_weeks: 2,
        repeat_until: "2026-11-03",
      }).repeat_until
    ).toBe("2026-11-03");

    expectVisitError(
      {
        ...VALID_VISIT,
        repeat_every_weeks: 2,
        repeat_until: "2026-11-02",
      },
      "The last date cannot be before the visit date."
    );
    expectVisitError(
      {
        ...VALID_VISIT,
        repeat_every_weeks: 2,
        repeat_until: "2026-02-30",
      },
      "Enter a valid last date."
    );
  });

  it("ignores the repeat end date when there is no repeat", () => {
    const value = expectVisitOk({
      ...VALID_VISIT,
      repeat_until: "not-a-date",
    });

    expect(value.repeat_every_weeks).toBeNull();
    expect(value.repeat_until).toBeNull();
  });

  it("enforces the optional field length limits", () => {
    expectVisitError(
      { ...VALID_VISIT, service: "1".repeat(501) },
      "Service must be 500 characters or fewer."
    );
    expectVisitError(
      { ...VALID_VISIT, notes: "1".repeat(2001) },
      "Notes must be 2000 characters or fewer."
    );

    const value = expectVisitOk({
      ...VALID_VISIT,
      service: " ",
      notes: " ",
    });
    expect(value.service).toBeNull();
    expect(value.notes).toBeNull();
  });

  it("rejects a body that is not an object", () => {
    expectVisitError(null, "Could not read the visit details.");
    expectVisitError([], "Could not read the visit details.");
    expectVisitError("nope", "Could not read the visit details.");
  });
});

describe("visit statuses", () => {
  it("lists the allowed statuses", () => {
    expect(VISIT_STATUSES).toEqual([
      "scheduled",
      "confirmed",
      "reschedule_requested",
      "cancelled",
      "done",
    ]);
  });

  it("recognizes only the allowed statuses", () => {
    for (const status of VISIT_STATUSES) {
      expect(isVisitStatus(status)).toBe(true);
    }
    expect(isVisitStatus("pending")).toBe(false);
    expect(isVisitStatus(null)).toBe(false);
    expect(isVisitStatus(42)).toBe(false);
  });
});
