import { describe, it, expect } from "vitest";
import { dateISOInZone, endOfDayInZone, formatDayInZone, formatTimeInZone, formatLongDateInZone } from "@/lib/dates";

describe("dates in a studio timezone", () => {
  // 03:30 UTC on March 4 is still the evening of March 3 in Los Angeles.
  const instant = "2026-03-04T03:30:00.000Z";

  it("derives the calendar date in the zone, not in UTC", () => {
    expect(dateISOInZone(instant, "America/Los_Angeles")).toBe("2026-03-03");
    expect(dateISOInZone(instant, "UTC")).toBe("2026-03-04");
    expect(dateISOInZone(instant, "Asia/Tokyo")).toBe("2026-03-04");
  });

  it("formats day, long date and time in the zone", () => {
    expect(formatDayInZone(instant, "America/Los_Angeles")).toBe("Tuesday, March 3");
    expect(formatLongDateInZone(instant, "America/Los_Angeles")).toBe("March 3, 2026");
    expect(formatTimeInZone(instant, "America/Los_Angeles")).toBe("7:30 PM");
    expect(formatTimeInZone(instant, "Europe/Paris")).toBe("4:30 AM");
  });

  it("ends the day at 23:59:59 local time", () => {
    const end = endOfDayInZone("2026-03-03", "America/New_York");
    expect(end.toISOString()).toBe("2026-03-04T04:59:59.000Z");
    expect(dateISOInZone(end, "America/New_York")).toBe("2026-03-03");
    // Across a DST change the offset differs but the local date still holds.
    expect(dateISOInZone(endOfDayInZone("2026-07-01", "America/New_York"), "America/New_York")).toBe("2026-07-01");
  });

  it("falls back to UTC for an unknown zone instead of throwing", () => {
    expect(dateISOInZone(instant, "Mars/Olympus")).toBe("2026-03-04");
    expect(dateISOInZone(instant, null)).toBe("2026-03-04");
  });
});
