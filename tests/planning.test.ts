import { describe, expect, it } from "vitest";
import { addShots, toggleShot, planHasContent, type ShotItem } from "@/lib/planning";

describe("shot list", () => {
  it("adds shots, trims and dedupes case-insensitively", () => {
    const start: ShotItem[] = [{ id: "a", text: "Head and shoulders", done: false }];
    const next = addShots(start, ["  Seated  ", "head and shoulders", "", "Full length"]);
    expect(next.map((s) => s.text)).toEqual(["Head and shoulders", "Seated", "Full length"]);
    expect(new Set(next.map((s) => s.id)).size).toBe(next.length); // ids are unique
  });
  it("toggles only the matching shot's done flag", () => {
    const list: ShotItem[] = [{ id: "a", text: "A", done: false }, { id: "b", text: "B", done: false }];
    const after = toggleShot(list, "b");
    expect(after.find((s) => s.id === "a")?.done).toBe(false);
    expect(after.find((s) => s.id === "b")?.done).toBe(true);
  });
});

describe("plan sharing gate", () => {
  const empty = { notes_md: "", shot_list: [] as ShotItem[], mood_asset_ids: [] as string[] };
  it("treats an empty or whitespace-only plan as nothing to share", () => {
    expect(planHasContent(null)).toBe(false);
    expect(planHasContent(empty)).toBe(false);
    expect(planHasContent({ ...empty, notes_md: "   " })).toBe(false);
  });
  it("shares when there are notes, shots or reference images", () => {
    expect(planHasContent({ ...empty, notes_md: "Bring two outfits" })).toBe(true);
    expect(planHasContent({ ...empty, shot_list: [{ id: "a", text: "Seated", done: false }] })).toBe(true);
    expect(planHasContent({ ...empty, mood_asset_ids: ["11111111-1111-1111-1111-111111111111"] })).toBe(true);
  });
});
