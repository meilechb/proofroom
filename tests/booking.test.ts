import { describe, expect, it } from "vitest";
import { DEFAULT_BOOKING, addDaysISO, localDateISO, openWeekdays, slotsForDate, tzOffsetMinutes, weekdayOfISO, withinChangeWindow, zonedTime } from "@/lib/booking";

const tz = "America/New_York";
const settings = { ...DEFAULT_BOOKING, enabled: true, leadTimeHours: 0, bufferMinutes: 15, slotStepMinutes: 30, maxPerDay: 6 };

describe("time zones", () => {
  it("converts wall time to instants across DST", () => {
    // 2026-03-08 is the US spring-forward date.
    expect(zonedTime("2026-03-07", "09:00", tz).toISOString()).toBe("2026-03-07T14:00:00.000Z");
    expect(zonedTime("2026-03-09", "09:00", tz).toISOString()).toBe("2026-03-09T13:00:00.000Z");
    expect(tzOffsetMinutes(new Date("2026-07-01T12:00:00Z"), tz)).toBe(-240);
    expect(localDateISO(new Date("2026-07-01T03:00:00Z"), tz)).toBe("2026-06-30");
  });
});

describe("slotsForDate", () => {
  const now = new Date("2026-09-01T00:00:00Z");
  it("cuts a working day into slots of the package length", () => {
    // Wednesday 09:00-17:00, 60-minute sessions, 30-minute steps: 09:00 .. 16:00 = 15 slots
    const slots = slotsForDate("2026-09-09", tz, settings, 60, [], now);
    expect(slots).toHaveLength(15);
    expect(slots[0].toISOString()).toBe("2026-09-09T13:00:00.000Z");
    expect(slots.at(-1)!.toISOString()).toBe("2026-09-09T20:00:00.000Z");
  });
  it("removes slots that overlap a booking plus its buffer", () => {
    const busy = [{ starts_at: "2026-09-09T15:00:00Z", ends_at: "2026-09-09T16:00:00Z" }]; // 11:00-12:00 local
    const slots = slotsForDate("2026-09-09", tz, settings, 60, busy, now).map((d) => d.toISOString());
    expect(slots).not.toContain("2026-09-09T14:30:00.000Z"); // 10:30 would end 11:30, inside the buffer
    expect(slots).not.toContain("2026-09-09T15:00:00.000Z");
    expect(slots).toContain("2026-09-09T13:30:00.000Z"); // 09:30-10:30 ends before 10:45 buffer start
    expect(slots).toContain("2026-09-09T16:30:00.000Z"); // 12:30 starts after the 12:15 buffer end
  });
  it("honours lead time, blocked dates, closed days and the daily maximum", () => {
    expect(slotsForDate("2026-09-13", tz, settings, 60, [], now)).toHaveLength(0); // Sunday closed
    expect(slotsForDate("2026-09-09", tz, { ...settings, blockedDates: ["2026-09-09"] }, 60, [], now)).toHaveLength(0);
    const soon = new Date("2026-09-09T12:00:00Z");
    expect(slotsForDate("2026-09-09", tz, { ...settings, leadTimeHours: 2 }, 60, [], soon)[0].toISOString()).toBe("2026-09-09T14:00:00.000Z");
    const full = Array.from({ length: 6 }, (_, i) => ({ starts_at: `2026-09-09T${13 + i}:00:00Z`, ends_at: `2026-09-09T${13 + i}:30:00Z` }));
    expect(slotsForDate("2026-09-09", tz, settings, 60, full, now)).toHaveLength(0);
  });
});

describe("calendar helpers", () => {
  it("lists the weekdays that have open hours", () => {
    expect(openWeekdays({ ...DEFAULT_BOOKING })).toEqual([1, 2, 3, 4, 5]); // Mon-Fri by default
    expect(openWeekdays({ ...DEFAULT_BOOKING, weekly: { ...DEFAULT_BOOKING.weekly, "6": [{ start: "10:00", end: "14:00" }] } })).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("adds days across month boundaries without timezone drift", () => {
    expect(addDaysISO("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysISO("2026-12-25", 60)).toBe("2027-02-23");
  });
  it("reads the weekday of a date string the same way slot math does", () => {
    expect(weekdayOfISO("2026-09-13")).toBe(0); // Sunday
    expect(weekdayOfISO("2026-09-09")).toBe(3); // Wednesday
  });
  it("closes self-service changes inside the cancellation window", () => {
    const starts = new Date("2026-09-10T15:00:00Z");
    expect(withinChangeWindow(starts, 48, new Date("2026-09-08T12:00:00Z"))).toBe(true); // more than 48h out
    expect(withinChangeWindow(starts, 48, new Date("2026-09-09T12:00:00Z"))).toBe(false); // 27h out
    expect(withinChangeWindow(starts, 0, new Date("2026-09-10T14:59:00Z"))).toBe(true); // no window: any time before
  });
});
