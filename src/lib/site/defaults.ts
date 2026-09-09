import { siteSchema, type Site } from "@/lib/site/schema";

/**
 * Starter copy for a headshot studio (plan 3.67), adapted from the original
 * single-studio site so a new studio's website reads well before any editing.
 * {studio} and {location} are filled at creation time.
 */
export function defaultSite(studioName: string, location = "your area"): Site {
  const s = studioName.trim() || "Our studio";
  const where = location.trim() || "your area";
  return siteSchema.parse({
    settings: { tagline: `Professional headshots in ${where}` },
    home: {
      hero: { heading: "Stand out from the crowd", subheading: `Professional headshots in ${where}, in the studio or at your office.`, button: { label: "Book a session", target: "contact" }, secondaryButton: { label: "See the portfolio", target: "portfolio" } },
      intro: { heading: `Headshots that look like you on your best day`, body: `${s} photographs business, LinkedIn, team and actor headshots. Sessions are relaxed and quick, with coaching on posing and expression, and proofs arrive in a private online gallery within a day.` },
      portfolioStrip: { heading: "Recent work", limit: 6, featuredOnly: true },
      packages: { heading: "Pricing", body: "Every session includes a private online proof gallery and retouched files sized for web and print." },
      testimonials: { heading: "What clients say", limit: 6 },
      faq: {
        heading: "Questions",
        items: [
          { q: "How do I pay?", a: "A deposit reserves your date. The balance is due when your final images are delivered, paid securely online." },
          { q: "What should I wear?", a: "Solid colors and simple necklines photograph best. Bring two options if you can." },
          { q: "How are the photos delivered?", a: "Through a private online gallery where you can download web and print sizes." },
          { q: "Do you photograph teams?", a: "Yes. On-site sessions keep the background and lighting consistent for the whole staff page." },
        ],
      },
      location: { heading: "The studio", body: "Easy to reach, with parking nearby. On-location sessions are available for teams." },
      cta: { heading: "Ready to look your best?", body: "Send a few dates that work and we will confirm within one business day.", button: { label: "Get in touch", target: "contact" } },
    },
    portfolio: {
      hero: { heading: "Portfolio", subheading: "A selection of recent headshots." },
      grid: { showFilters: true, limit: 60 },
      cta: { heading: "Want to stand out?", button: { label: "See pricing", target: "pricing" } },
    },
    pricing: {
      hero: { heading: "Pricing", subheading: "Simple packages. No surprises." },
      packages: { body: "Every session includes a private online proof gallery and retouched files sized for web and print.", buttonLabel: "Book" },
      included: { heading: "Every session includes", items: ["Coaching on posing and expression", "Private online proof gallery", "Retouched files for web and print", "Delivery within a few business days"] },
      faq: {
        heading: "Questions",
        items: [
          { q: "How many photos do I get?", a: "Each package lists the number of retouched images included. Extra images can be added when you choose your favorites." },
          { q: "Can I reschedule?", a: "Yes, once at no charge with 48 hours notice." },
        ],
      },
      cta: { heading: "Book your session", button: { label: "Book a session", target: "contact" } },
    },
    about: {
      hero: { heading: `About ${s}`, subheading: "" },
      bio: { heading: "Hello", body: "Write a few paragraphs about who you are, how you work, and what clients can expect on the day." },
      steps: {
        heading: "How it works",
        items: [
          { title: "Book", text: "Send the form with a few dates that work. We confirm within one business day." },
          { title: "Shoot", text: "A relaxed session in the studio or at your office. Coaching on posing and expression included." },
          { title: "Choose and receive", text: "Proofs are posted to a private gallery. Mark your favorites and the retouched files follow within days." },
        ],
      },
      cta: { heading: "Ready to book?", button: { label: "Get in touch", target: "contact" } },
    },
    contact: {
      hero: { heading: "Contact", subheading: "Tell us what the photos are for and a few dates that work." },
      form: { showPackagePicker: true, showPhone: true, showPreferredDate: true, successMessage: "Thanks. We will be in touch within one business day." },
      details: { showAddress: true, showHours: true, showMap: true },
    },
    gallery: { heading: "Open your gallery", body: "Enter the code from your email to see your photos." },
    book: { enabled: false, heading: "Book a session", body: "Pick a package and a time that works for you." },
    areas: { enabled: false, headingPattern: "Headshots in {town}", bodyPattern: `${s} photographs professional headshots for people and teams in {town}. Sessions in the studio or at your office.` },
    seo: { siteTitle: `${s} | Headshot photographer in ${where}`, siteDescription: `Professional headshots by ${s}. Business, LinkedIn, team and actor headshots in the studio or at your office.`, pages: {} },
  });
}
