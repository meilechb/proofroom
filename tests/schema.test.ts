import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * db/schema.sql is applied on every deploy, so every statement must be safe to
 * run twice. This test enforces the allowed statement shapes the same way
 * scripts/db-migrate.mjs splits the file, without needing a database.
 */
const text = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const statements = text
  .split(/;\s*\n/)
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

const IDEMPOTENT = [
  /^create extension if not exists /i,
  /^create table if not exists /i,
  /^create (unique )?index if not exists /i,
  /^alter table \w+ add column if not exists /i,
  /^alter table \w+ drop column if exists /i,
  /^alter table \w+ drop constraint if exists /i,
  /^alter table \w+ alter column \w+ set default /i,
  /^drop table if exists /i,
  /^drop trigger if exists /i,
  /^create or replace function /i,
  /^update \w+ set /i,
];

describe("db/schema.sql", () => {
  it("has statements", () => {
    expect(statements.length).toBeGreaterThan(50);
  });

  it("only contains idempotent statement shapes (or a constraint/trigger add right after its drop)", () => {
    const offenders: string[] = [];
    statements.forEach((stmt, i) => {
      if (IDEMPOTENT.some((re) => re.test(stmt))) return;
      const prev = statements[i - 1] ?? "";
      const addConstraint = stmt.match(/^alter table (\w+) add constraint (\w+) /i);
      if (addConstraint) {
        const [, table, name] = addConstraint;
        if (new RegExp(`^alter table ${table} drop constraint if exists ${name}$`, "i").test(prev)) return;
      }
      const createTrigger = stmt.match(/^create trigger (\w+) /i);
      if (createTrigger) {
        const [, name] = createTrigger;
        if (new RegExp(`^drop trigger if exists ${name} on \\w+$`, "i").test(prev)) return;
      }
      offenders.push(stmt.split("\n")[0].slice(0, 100));
    });
    expect(offenders).toEqual([]);
  });

  it("never re-declares a table twice", () => {
    const names = statements.map((s) => s.match(/^create table if not exists (\w+)/i)?.[1]).filter(Boolean);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every tenant table carries studio_id or hangs off one that does", () => {
    const tenantless = ["studios", "users", "referrals", "platform_settings", "rate_limits", "stripe_events", "leads", "gallery_visits", "gallery_downloads", "import_files", "memberships", "invitations", "sessions", "auth_tokens", "photo_selections", "photo_comments", "marketing_views_daily"];
    for (const stmt of statements) {
      const m = stmt.match(/^create table if not exists (\w+)\s*\(([\s\S]*)\)$/i);
      if (!m) continue;
      const [, name, body] = m;
      if (tenantless.includes(name)) continue;
      expect(body, `${name} is missing studio_id`).toMatch(/\bstudio_id uuid/);
    }
  });
});
