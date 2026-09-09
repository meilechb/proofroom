#!/usr/bin/env node
// Applies db/schema.sql to DATABASE_URL. Every statement is idempotent so this
// runs at the start of every `npm run build` (Vercel deploy).
//   --if-configured   succeed with a note when DATABASE_URL is missing
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  if (process.argv.includes("--if-configured")) {
    console.log("db-migrate: DATABASE_URL is not set, skipping schema update.");
    process.exit(0);
  }
  console.error("DATABASE_URL is not set. Copy it from Neon → Connect and run:\n  DATABASE_URL=postgres://... npm run db:migrate");
  process.exit(1);
}

const sql = neon(url);
const text = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const statements = text
  .split(/;\s*\n/)
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);
console.log(`db/schema.sql: ${statements.length} statements`);
for (const statement of statements) {
  await sql.query(statement);
}
const [{ count }] = await sql`select count(*)::int as count from studios`;
console.log(`Done. ${count} studio(s).`);
