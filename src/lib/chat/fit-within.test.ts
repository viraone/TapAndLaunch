import { describe, expect, it } from "vitest";
import { fitWithin } from "./fit-within";

describe("fitWithin", () => {
  it("scales a landscape picture down", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("scales a portrait picture down", () => {
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("rounds the scaled dimensions", () => {
    expect(fitWithin(3000, 2000, 1600)).toEqual({ width: 1600, height: 1067 });
  });

  it("does not scale up a smaller picture", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("leaves an exactly-max picture unchanged", () => {
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("returns 1x1 for a non-positive width", () => {
    expect(fitWithin(0, 100, 1600)).toEqual({ width: 1, height: 1 });
  });

  it("returns 1x1 for a NaN dimension", () => {
    expect(fitWithin(Number.NaN, 100, 1600)).toEqual({ width: 1, height: 1 });
  });
});
