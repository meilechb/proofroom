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

// Revision 4 schemas (plan 3.93)

export const packageSchema = z.object({
  name: z.string().trim().min(1, "Name the package.").max(80),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  priceCents: z.coerce.number().int().min(0).max(10_000_000),
  depositCents: z.coerce.number().int().min(0).max(10_000_000),
  includedFinals: z.coerce.number().int().min(0).max(1000),
  extraFinalCents: z.coerce.number().int().min(0).max(1_000_000),
  turnaround: z.string().trim().max(120).optional().or(z.literal("")),
  isFeatured: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  durationMinutes: z.coerce.number().int().min(0).max(1440).optional(),
  bookable: z.coerce.boolean().optional(),
});

export const storeProductSchema = z.object({
  title: z.string().trim().min(1, "Name the product.").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  licenseText: z.string().trim().max(4000).optional().or(z.literal("")),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
});

export const storePriceRowSchema = z.object({
  resolution: z.enum(["web", "standard", "original"]),
  license: z.enum(["personal", "rf", "rm", "extended"]),
  amountCents: z.coerce.number().int().min(0).max(10_000_000),
});

export const storeSettingsSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  paymentMode: z.enum(["connected", "marketplace", "manual"]),
  taxMode: z.enum(["off", "stripe"]),
  commissionBps: z.coerce.number().int().min(0).max(10_000),
  watermark: z.coerce.boolean().optional(),
  watermarkText: z.string().trim().max(60).optional().or(z.literal("")),
  downloadMaxCount: z.coerce.number().int().min(1).max(100),
  downloadWindowHours: z.coerce.number().int().min(1).max(8760),
  deliveryPolicy: z.string().trim().max(4000).optional().or(z.literal("")),
  manualInstructions: z.string().trim().max(4000).optional().or(z.literal("")),
  manualPaymentLink: z.string().trim().url("Enter a full URL.").max(500).optional().or(z.literal("")),
});

export const storeDiscountSchema = z.object({
  code: z.string().trim().min(2, "Enter a code of at least 2 characters.").max(40).regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, - and _ only."),
  kind: z.enum(["percent", "fixed", "free_ship"]),
  value: z.coerce.number().int().min(0).max(10_000_000),
  minSubtotalCents: z.coerce.number().int().min(0).max(10_000_000).optional(),
  maxUses: z.coerce.number().int().min(1).max(1_000_000).optional(),
});

export const storeGiftCardSchema = z.object({
  initialCents: z.coerce.number().int().min(1, "Enter an amount.").max(10_000_000),
  expiresAt: z.string().datetime({ offset: true }).optional().or(z.literal("")),
});

export const storePriceSheetSchema = z.object({
  name: z.string().trim().min(1, "Name the price sheet.").max(80),
});

export const orderSchema = z.object({
  clientId: z.string().uuid(),
  packageId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  scheduledAt: z.string().datetime({ offset: true }).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  discountCents: z.coerce.number().int().min(0).max(10_000_000).optional(),
});

export const gallerySettingsSchema = z.object({
  title: z.string().trim().min(1, "Give the gallery a title.").max(120),
  kind: z.enum(["proof", "final"]),
  welcome_message: z.string().trim().max(2000).optional().or(z.literal("")),
  allow_downloads: z.coerce.boolean().optional(),
  allow_comments: z.coerce.boolean().optional(),
  allow_client_upload: z.coerce.boolean().optional(),
  allow_sharing: z.coerce.boolean().optional(),
  watermark: z.coerce.boolean().optional(),
  pay_gated: z.coerce.boolean().optional(),
  download_size: z.enum(["web", "full", "both"]).optional(),
  sort_mode: z.enum(["manual", "filename", "captured"]).optional(),
  expires_at: z.string().date().optional().or(z.literal("")),
  password: z.string().max(64).optional().or(z.literal("")),
  download_pin: z.string().regex(/^\d{4,8}$/, "Use 4 to 8 digits.").optional().or(z.literal("")),
});

export const sendingDomainSchema = z.object({ domain: domainSchema, fromLocalPart: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{1,64}$/, "Use letters, numbers, dots, dashes or underscores.").default("hello") });

export const referralCodeSchema = z.string().trim().toUpperCase().regex(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/, "That code is not valid.");

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM.");
const window = z.object({ start: hhmm, end: hhmm }).refine((w) => w.start < w.end, { message: "End must be after start." });

export const bookingSettingsSchema = z.object({
  enabled: z.coerce.boolean(),
  weekly: z.object({ "0": z.array(window), "1": z.array(window), "2": z.array(window), "3": z.array(window), "4": z.array(window), "5": z.array(window), "6": z.array(window) }),
  bufferMinutes: z.coerce.number().int().min(0).max(240),
  leadTimeHours: z.coerce.number().int().min(0).max(24 * 60),
  maxPerDay: z.coerce.number().int().min(1).max(50),
  slotStepMinutes: z.coerce.number().int().min(5).max(240),
  depositRequired: z.coerce.boolean(),
  policy: z.string().trim().max(2000),
  blockedDates: z.array(z.string().date()).max(366),
});

export const bookingRequestSchema = z.object({
  packageId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: emailSchema,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  agree: z.literal(true, { error: "Please agree to the policy." }),
});

export const importMappingSchema = z.object({
  galleries: z.array(z.object({ folder: z.string().max(300), title: z.string().trim().min(1).max(120), clientId: z.string().uuid().nullable(), clientEmail: emailSchema.optional(), clientName: z.string().trim().max(120).optional(), kind: z.enum(["proof", "final"]), include: z.boolean() })).max(500),
});

export const shotItemSchema = z.object({ id: z.string().max(40), text: z.string().trim().min(1).max(200), done: z.boolean() });

export const sessionPlanSchema = z.object({
  notes_md: z.string().max(20000).optional(),
  shot_list: z.array(shotItemSchema).max(200).optional(),
  mood_asset_ids: z.array(z.string().uuid()).max(60).optional(),
  client_visible: z.coerce.boolean().optional(),
});

export const broadcastFilterSchema = z.object({
  stages: z.array(z.enum(["lead", "awaiting_payment", "booked", "proofing", "delivered", "archived"])).optional(),
  tags: z.array(z.string().trim().toLowerCase().max(40)).optional(),
  activeSinceDays: z.coerce.number().int().min(1).max(3650).optional(),
});
