import {
  getCurrentLocalTime,
  getCurrentLocalDate,
  isWithinTimeWindow,
} from "./time-utils";

describe("getCurrentLocalTime", () => {
  it("returns a string in HH:MM format for UTC timezone", () => {
    const result = getCurrentLocalTime("UTC");
    expect(result).toMatch(/^\d{2}:\d{2}$/);
    const [h, m] = result.split(":").map(Number);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(23);
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThanOrEqual(59);
  });

  it("returns a string in HH:MM format for America/New_York", () => {
    const result = getCurrentLocalTime("America/New_York");
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it("zero-pads hours and minutes", () => {
    // Mock Date to a time where UTC would be 01:05
    const RealDate = Date;
    const mockDate = new RealDate("2024-01-15T01:05:00.000Z");
    jest.spyOn(global, "Date").mockImplementation(() => mockDate as Date);
    (global.Date as unknown as { now: () => number }).now = () => mockDate.getTime();

    const result = getCurrentLocalTime("UTC");
    expect(result).toBe("01:05");

    jest.restoreAllMocks();
  });
});

describe("getCurrentLocalDate", () => {
  it("returns a string in YYYY-MM-DD format for UTC timezone", () => {
    const result = getCurrentLocalDate("UTC");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns the correct date for a known UTC timestamp", () => {
    const RealDate = Date;
    const mockDate = new RealDate("2024-03-15T10:30:00.000Z");
    jest.spyOn(global, "Date").mockImplementation(() => mockDate as Date);
    (global.Date as unknown as { now: () => number }).now = () => mockDate.getTime();

    const result = getCurrentLocalDate("UTC");
    expect(result).toBe("2024-03-15");

    jest.restoreAllMocks();
  });
});

describe("isWithinTimeWindow", () => {
  it("returns true for an exact match", () => {
    expect(isWithinTimeWindow("08:30", "08:30")).toBe(true);
  });

  it("returns true when target is exactly +7 minutes (inclusive boundary)", () => {
    expect(isWithinTimeWindow("08:30", "08:37")).toBe(true);
  });

  it("returns false when target is +8 minutes (exclusive)", () => {
    expect(isWithinTimeWindow("08:30", "08:38")).toBe(false);
  });

  it("returns true when target is exactly -7 minutes (inclusive boundary)", () => {
    expect(isWithinTimeWindow("08:30", "08:23")).toBe(true);
  });

  it("returns false when target is -8 minutes (exclusive)", () => {
    expect(isWithinTimeWindow("08:30", "08:22")).toBe(false);
  });

  it("returns true when target is +3 minutes (within default window)", () => {
    expect(isWithinTimeWindow("14:00", "14:03")).toBe(true);
  });

  it("returns true with a custom window of 15 minutes for +14 min", () => {
    expect(isWithinTimeWindow("09:00", "09:14", 15)).toBe(true);
  });

  it("returns false with a custom window of 15 minutes for +16 min", () => {
    expect(isWithinTimeWindow("09:00", "09:16", 15)).toBe(false);
  });

  it("handles midnight wraparound — 23:58 current, 00:02 target (4 min apart)", () => {
    expect(isWithinTimeWindow("23:58", "00:02")).toBe(true);
  });

  it("handles midnight wraparound — 00:03 current, 23:58 target (5 min apart)", () => {
    expect(isWithinTimeWindow("00:03", "23:58")).toBe(true);
  });

  it("returns false for midnight wraparound outside window — 23:50 vs 00:02 (12 min apart)", () => {
    expect(isWithinTimeWindow("23:50", "00:02")).toBe(false);
  });

  it("handles wraparound exactly at boundary — 23:53 vs 00:00 (7 min apart)", () => {
    expect(isWithinTimeWindow("23:53", "00:00")).toBe(true);
  });
});
