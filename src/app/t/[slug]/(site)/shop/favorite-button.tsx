import { toggleFavoriteAction } from "./actions";

/** Heart toggle for the storefront. Renders a form posting the server action so
 * it works without JavaScript; the caller positions it via className. */
export function FavoriteButton({ slug, productId, favorited, className }: { slug: string; productId: string; favorited: boolean; className?: string }) {
  return (
    <form action={toggleFavoriteAction} className={className}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="productId" value={productId} />
      <button
        type="submit"
        aria-label={favorited ? "Remove from favourites" : "Add to favourites"}
        aria-pressed={favorited}
        className="grid h-8 w-8 place-items-center rounded-full bg-[var(--site-bg)]/85 backdrop-blur text-[var(--site-ink)] shadow-sm hover:bg-[var(--site-bg)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={favorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden style={favorited ? { color: "var(--site-primary)" } : undefined}>
          <path d="M12 21 4.2 13.2a5.5 5.5 0 1 1 7.8-7.8l0 .1 0-.1a5.5 5.5 0 1 1 7.8 7.8Z" />
        </svg>
      </button>
    </form>
  );
}
