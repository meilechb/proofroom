#!/usr/bin/env node
// Grants platform admin to an existing user by email.
//   DATABASE_URL=... node scripts/make-platform-admin.mjs you@example.com
import { neon } from "@neondatabase/serverless";

const [, , email] = process.argv;
if (!email || !process.env.DATABASE_URL) {
  console.error("Usage: DATABASE_URL=... node scripts/make-platform-admin.mjs user@example.com");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`update users set is_platform_admin = true where lower(email) = lower(${email}) returning id, email`;
if (rows.length === 0) {
  console.error(`No user with email ${email}. Sign up first, then re-run.`);
  process.exit(1);
}
console.log(`${rows[0].email} is now a platform admin.`);
