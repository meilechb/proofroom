/**
 * Copy for /features/* (plan 8.11). Plain data so the route stays a thin
 * template and the words can be edited without touching layout.
 */

export type FeaturePage = {
  slug: string;
  nav: string;
  title: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  lead: string;
  screenshot: string;
  points: Array<{ title: string; body: string }>;
  steps: Array<{ title: string; body: string }>;
  faq: Array<{ q: string; a: string }>;
  related: string[];
};

export const FEATURE_PAGES: FeaturePage[] = [
  {
    slug: "website",
    nav: "Website",
    title: "A photography website you can finish this afternoon",
    metaTitle: "Website templates for photographers",
    description: "Two clean templates. Add your photos, colors and words, connect your domain, publish. Contact and booking forms feed your CRM.",
    eyebrow: "Website",
    lead: "Pick one of two templates, drop in your photos and words, choose your colors, and publish on your own domain. Every form on it feeds your inbox.",
    screenshot: "Website editor with live preview",
    points: [
      { title: "Two templates, not two hundred", body: "Editorial (large single images, long scroll) and Gallery (grid first). Both are fast, accessible and look right on a phone. You change background images, text, colors and which sections show." },
      { title: "Your own domain", body: "Point a domain or subdomain at your site. SSL is automatic. Until then you have a free address on ours." },
      { title: "Built-in pages", body: "Home, portfolio, packages with prices, about, areas you serve, contact and booking. Turn any of them off." },
      { title: "Forms that go somewhere", body: "Contact and booking forms create inquiries in your inbox and clients in your CRM. No plugin, no Zapier." },
      { title: "SEO basics done", body: "Titles, descriptions, Open Graph images, sitemap and structured data are generated from what you enter." },
      { title: "Change it any time", body: "Edit and preview, then publish when you are ready. The live site never shows half-finished changes." },
    ],
    steps: [
      { title: "Choose a template", body: "Preview both with your own logo and colors before you decide." },
      { title: "Fill in the sections", body: "Hero image, a paragraph about you, your packages, a few portfolio images." },
      { title: "Connect your domain", body: "Add one DNS record. We check it and switch the site over." },
    ],
    faq: [
      { q: "Can I add custom code or fonts?", a: "You can choose from a curated set of font pairs and set every color. Custom code is not supported; the templates are deliberately simple so they stay fast." },
      { q: "Can I keep my existing website?", a: "Yes. Many studios keep their site and use only the galleries and CRM. Your booking and gallery links work on any site." },
      { q: "Does the site show my galleries?", a: "Only what you choose. Portfolio images are picked by you; client galleries are private by default." },
    ],
    related: ["galleries", "booking", "crm"],
  },
  {
    slug: "galleries",
    nav: "Galleries",
    title: "Client galleries that collect decisions, not just views",
    metaTitle: "Client proofing galleries with favorites and notes",
    description: "Favorites, per-photo notes, selection limits, paid extras and downloads that unlock when the balance is paid. Everything syncs back into Lightroom.",
    eyebrow: "Client galleries",
    lead: "Clients favorite, leave a note on any photo, and pay. You get the picks and the notes back in Lightroom, and the downloads open when the balance clears.",
    screenshot: "Client gallery: favorites, notes and a locked download button",
    points: [
      { title: "Favorites and notes on every photo", body: "Clients mark favorites and write a note on a photo (\"crop tighter\", \"remove the exit sign\"). You see notes in your inbox and in Lightroom as keywords." },
      { title: "Selection limits and extras", body: "Set \"10 included, extras $25 each\" on the package. The gallery counts picks and adds extras to the balance without you sending an invoice." },
      { title: "Downloads unlocked by payment", body: "Web and full-resolution downloads stay locked until the balance is paid. The client pays, the button turns on." },
      { title: "Privacy controls", body: "Public link, PIN, email gate or client-only. Expiry dates with reminders. Watermarks on previews if you want them." },
      { title: "Fast on any connection", body: "Images are served in modern formats at the size the screen needs. Full-resolution originals are kept for the download." },
      { title: "Team headshot mode", body: "For a company day, each person gets their own gallery and the coordinator gets a master view of who has picked." },
    ],
    steps: [
      { title: "Publish from Lightroom", body: "Drag the selects to the Publish Service and click Publish. The gallery exists." },
      { title: "The client picks", body: "They get an email, open the gallery, favorite, and leave notes." },
      { title: "You finish", body: "Favorites arrive as a flag in Lightroom. Edit, republish, and the downloads are live." },
    ],
    faq: [
      { q: "How big can a gallery be?", a: "There is no photo or storage cap. Upload the wedding." },
      { q: "Can clients download originals?", a: "You choose per gallery: web size, full resolution, both, or none until paid." },
      { q: "Can I sell prints?", a: "Not through a print lab integration. You can sell extras, retouching and products as line items paid into your Stripe." },
    ],
    related: ["lightroom", "payments", "team-headshots"],
  },
  {
    slug: "crm",
    nav: "CRM",
    title: "The studio side of the job, in one place",
    metaTitle: "CRM for photographers: inbox, clients, sessions, tasks",
    description: "Inbox, clients, sessions, packages, orders, tasks and calendar. Import from Pixieset, Pic-Time, ShootProof, CloudSpot or CSV.",
    eyebrow: "CRM",
    lead: "Inquiries, clients, sessions, orders and tasks live next to the galleries they belong to. Nothing to sync, nothing to forget.",
    screenshot: "Client record with sessions, galleries, invoices and notes",
    points: [
      { title: "Inbox", body: "Every inquiry, booking request, client note and reply lands in one list. Reply from the app and it goes out from your domain." },
      { title: "Clients and sessions", body: "A client record shows every session, gallery, agreement, payment and email. A session ties a package, a date and a gallery together." },
      { title: "Packages and orders", body: "Define packages once (price, deposit, included photos, extras). Orders and invoices are generated from them." },
      { title: "Tasks and calendar", body: "Tasks with due dates, a calendar of sessions and holds, and an iCal feed for your phone." },
      { title: "Import", body: "Bring clients, sessions and galleries over from other tools with a guided importer. We map the fields and show you what changed before anything is written." },
      { title: "Team", body: "Invite as many people as you need. Roles keep billing and settings to owners and admins." },
    ],
    steps: [
      { title: "Import or start fresh", body: "Upload a CSV or an export from another tool. Or add your first client by hand in a minute." },
      { title: "Book a session", body: "Pick a client and a package. The deposit request and agreement go out." },
      { title: "Deliver and close", body: "Publish the gallery from Lightroom. The balance is collected and the session is done." },
    ],
    faq: [
      { q: "Can I import from my current tool?", a: "Importers cover Pixieset, Pic-Time, ShootProof and CloudSpot exports plus generic CSV. Each vendor's export format is documented on the import page." },
      { q: "Is there a client portal?", a: "Yes. Every client has a hub page with their galleries, agreements, invoices and receipts, protected by a magic link." },
      { q: "Does it do accounting?", a: "It records payments and issues receipts. Export CSV for your accountant or bookkeeping tool." },
    ],
    related: ["email", "booking", "payments"],
  },
  {
    slug: "payments",
    nav: "Payments",
    title: "Paid into your own Stripe. We take 0%.",
    metaTitle: "Photography payments with 0% commission, in your own Stripe",
    description: "Deposits, balances, extras and e-signed agreements. Clients pay on your own Stripe account. No platform fee, no held funds.",
    eyebrow: "Payments",
    lead: "Clients pay deposits and balances by card on your own Stripe account. The money settles in your Stripe balance and pays out to your bank on Stripe's schedule. We add nothing.",
    screenshot: "Pay page: deposit, agreement and card form",
    points: [
      { title: "Your Stripe account", body: "Connect an existing Stripe account or create one during setup. Charges, refunds and disputes appear in your own Stripe dashboard." },
      { title: "0% platform fee", body: "We charge the subscription and nothing else. Stripe's standard card fee applies, as with any processor, and goes to Stripe." },
      { title: "Deposits and balances", body: "Packages define a deposit. The client pays it at booking, signs the agreement, and pays the balance before downloads unlock." },
      { title: "E-signed agreements", body: "Your contract text with the client's details filled in. Signed by typing a name, with time, IP and a PDF copy on both sides." },
      { title: "Extras and tips", body: "Selection extras and add-ons are added to the balance automatically. Optional tip line at checkout." },
      { title: "Manual payments", body: "Record cash, check or bank transfer by hand. The receipt and the balance update the same way." },
    ],
    steps: [
      { title: "Connect Stripe", body: "One click if you have an account; a few minutes if you do not. Stripe verifies your business, not us." },
      { title: "Send the request", body: "Booking creates a pay link. The client sees the amount, the agreement and a card form." },
      { title: "Money lands in Stripe", body: "Your Stripe balance, your payout schedule, your dashboard. We record the payment and unlock the gallery." },
    ],
    faq: [
      { q: "Do you ever hold my money?", a: "No. Charges are created directly on your Stripe account. We never receive, route or hold funds and cannot delay a payout." },
      { q: "What about refunds and disputes?", a: "You issue refunds from your Stripe dashboard or from the order page. Disputes are handled with Stripe; we show the status on the order." },
      { q: "Which countries?", a: "Anywhere Stripe supports card payments for your business type. Stripe's own country list applies." },
    ],
    related: ["galleries", "crm", "email"],
  },
  {
    slug: "lightroom",
    nav: "Lightroom",
    title: "Publish from Lightroom Classic. Get the picks back.",
    metaTitle: "Two-way Lightroom Classic plugin for client proofing",
    description: "A Publish Service for Lightroom Classic. Publish galleries, then pull client favorites back as flags and notes as keywords.",
    eyebrow: "Lightroom plugin",
    lead: "The plugin adds a Publish Service. Drag photos in, click Publish, and the gallery is live. When the client picks, favorites come back as a flag and notes as keywords.",
    screenshot: "Lightroom Classic Publish Services panel with synced favorites",
    points: [
      { title: "Publish, do not export", body: "Galleries are Publish Services. Edit a photo, republish, and the client sees the new version at the same link." },
      { title: "Favorites back as flags", body: "One click pulls the client's favorites into Lightroom as a flag and a keyword, so a Smart Collection of picks builds itself." },
      { title: "Notes as keywords", body: "Per-photo notes arrive as keywords under a \"Client notes\" parent, so you read the request while you edit the photo." },
      { title: "Upload originals or web size", body: "Choose per gallery. Full-resolution uploads become the download; web-size uploads keep things quick for proofing." },
      { title: "Tokens, not passwords", body: "The plugin authenticates with a token you create in settings and can revoke any time." },
      { title: "macOS and Windows", body: "Lightroom Classic 12 and later. Lightroom (cloud) does not support third-party publish plugins." },
    ],
    steps: [
      { title: "Install", body: "Download the plugin, add it in Lightroom's Plug-in Manager, paste your token." },
      { title: "Publish", body: "Create a gallery in the Publish Service, drag photos in, click Publish." },
      { title: "Sync", body: "After the client picks, click Sync Favorites. Flags and keywords appear." },
    ],
    faq: [
      { q: "Does it work with Lightroom (cloud) or Capture One?", a: "No. Adobe's plugin SDK exists only for Lightroom Classic. You can still upload from the web app with any tool." },
      { q: "Will it slow Lightroom down?", a: "Uploads run in the background like any Publish Service. Syncing favorites is a single request." },
      { q: "Is the plugin included?", a: "Yes, for every studio on the one plan." },
    ],
    related: ["galleries", "payments", "crm"],
  },
  {
    slug: "team-headshots",
    nav: "Team headshots",
    title: "Company headshot days without the spreadsheet",
    metaTitle: "Team headshot day galleries with per-person picks",
    description: "One gallery per person, a master view for the coordinator, retouch selection with limits, and one invoice to the company.",
    eyebrow: "Team headshot days",
    lead: "Import the roster, shoot the day, publish once. Every person gets their own gallery to pick from; the office manager gets a master view of who has chosen and who has not.",
    screenshot: "Team day: master view with per-person status",
    points: [
      { title: "Roster import", body: "Paste names and emails or upload the HR CSV. Each row becomes a person with their own private gallery." },
      { title: "One publish, many galleries", body: "Publish the whole day from Lightroom. Photos are sorted to people by capture time, by keyword or by hand." },
      { title: "Per-person picks with limits", body: "\"Pick 1 for retouching, up to 3 extras at $35.\" Each person sees only their photos and their own limit." },
      { title: "Coordinator master view", body: "The office manager sees who has picked, sends reminders in one click, and downloads the final set with names on the files." },
      { title: "One invoice", body: "Bill the company for the day and let individuals pay for their own extras, or bill everything to the company." },
      { title: "Named files", body: "Downloads are renamed to the person's name, ready for the HR system." },
    ],
    steps: [
      { title: "Set up the day", body: "Create a team session, upload the roster, set the pick limit and extra price." },
      { title: "Shoot and publish", body: "Publish from Lightroom. Assign photos to people." },
      { title: "Everyone picks", body: "Each person gets a link. The coordinator watches progress and chases the stragglers." },
    ],
    faq: [
      { q: "Can people who were not on the roster be added later?", a: "Yes. Add a person at any time and assign their photos." },
      { q: "Can the company see everyone's photos?", a: "The coordinator's master view shows status and final picks. You can allow or hide unpicked photos." },
      { q: "Does it handle multiple photographers?", a: "Yes. Any team member can publish to the same day." },
    ],
    related: ["galleries", "booking", "payments"],
  },
  {
    slug: "booking",
    nav: "Booking",
    title: "A booking page with your real availability",
    metaTitle: "Photography booking page with deposits",
    description: "Clients pick a package and a time, pay the deposit and sign the agreement. Holds prevent double booking. Confirmations and reminders go out on their own.",
    eyebrow: "Booking",
    lead: "Publish your availability by package. Clients choose a slot, pay the deposit, sign the agreement and get a confirmation. The session appears on your calendar.",
    screenshot: "Booking page: package, date and time selection",
    points: [
      { title: "Availability by package", body: "Headshots on Tuesday mornings, families on Saturday. Each package has its own hours, buffer and lead time." },
      { title: "Holds, not hope", body: "A slot is held while the client is paying, so two people cannot book the same time." },
      { title: "Deposit and agreement at booking", body: "The deposit and signature happen before the slot is confirmed. No chasing later." },
      { title: "Your calendar", body: "Sessions appear on the studio calendar and in your phone's calendar through an iCal feed. Block time off in either." },
      { title: "Confirmations and reminders", body: "Confirmation immediately, a reminder before the session, a gallery-ready email after. All from your domain." },
      { title: "Mini sessions", body: "Set a date, a duration and a price, and a run of back-to-back slots is generated." },
    ],
    steps: [
      { title: "Set your hours", body: "Per package, with buffers and how far ahead people can book." },
      { title: "Share the link", body: "On your website, in your email signature, on Instagram." },
      { title: "Get booked", body: "Deposit paid, agreement signed, calendar updated." },
    ],
    faq: [
      { q: "Can clients reschedule?", a: "Yes, within a window you set. Both calendars update and the client gets a new confirmation." },
      { q: "Does it read my Google Calendar?", a: "It publishes an iCal feed you can subscribe to. Two-way calendar sync is not available yet." },
      { q: "Can I approve bookings first?", a: "Yes. Set a package to request mode and you confirm each booking before the deposit is charged." },
    ],
    related: ["website", "crm", "email"],
  },
  {
    slug: "email",
    nav: "Email",
    title: "Client email from your own domain",
    metaTitle: "Photography client emails and automations from your own domain",
    description: "Gallery delivery, reminders, follow-ups and broadcasts sent from your domain, with unsubscribe handled. Automations you can read in one sentence.",
    eyebrow: "Email",
    lead: "Gallery-ready emails, payment reminders, session reminders and follow-ups go out from your address, not ours. Set the automations once and read them in plain sentences.",
    screenshot: "Automations: gallery ready, balance reminder, expiring soon",
    points: [
      { title: "Your domain", body: "Verify a sending domain with two DNS records. Emails come from you, replies go to you, and your deliverability is your own." },
      { title: "Automations in a sentence", body: "\"When a gallery is published, email the client.\" \"Three days before a gallery expires, remind them.\" Turn each on or off." },
      { title: "Templates you control", body: "Edit the wording of every email. Merge fields for names, dates, links and amounts." },
      { title: "Broadcasts", body: "Send a note to all past clients, or to a filtered list. Unsubscribe links and suppressions are handled for you." },
      { title: "Every send logged", body: "Delivered, opened, bounced or complained, next to the client it went to." },
      { title: "Replies land in your inbox", body: "The studio inbox, and your normal mailbox if you prefer." },
    ],
    steps: [
      { title: "Verify your domain", body: "Add two DNS records. We check and confirm." },
      { title: "Review the templates", body: "The defaults are plain and polite. Change any word." },
      { title: "Turn on automations", body: "Gallery ready, balance due, expiring soon, session reminder, thank you." },
    ],
    faq: [
      { q: "Can I send from Gmail or Outlook instead?", a: "Automations send through the platform from your verified domain so they are logged and tracked. Manual one-off replies can go from any mailbox." },
      { q: "Is there a sending limit?", a: "No fixed cap for normal studio use. Broadcasts are rate-limited to protect your domain's reputation." },
      { q: "Do you handle unsubscribes?", a: "Yes. Broadcasts include an unsubscribe link and honor list-unsubscribe headers. Transactional emails such as receipts are always delivered." },
    ],
    related: ["crm", "galleries", "booking"],
  },
];

export function featurePage(slug: string) {
  return FEATURE_PAGES.find((f) => f.slug === slug) ?? null;
}
