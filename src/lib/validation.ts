import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/password";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: emailSchema,
  password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`).max(PASSWORD_MAX),
  studioName: z.string().trim().min(2, "Enter your studio or business name.").max(120),
  slug: z.string().trim().toLowerCase().min(3).max(40),
  terms: z.literal(true, { error: "Please agree to the terms to continue." }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX),
});

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(120),
  email: emailSchema,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
});

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #1A2B3C.");

export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/, "Enter a domain like galleries.yourstudio.com.");

export function firstIssue(error: z.ZodError): { field: string; message: string } {
  const issue = error.issues[0];
  return { field: String(issue.path[0] ?? ""), message: issue.message };
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
