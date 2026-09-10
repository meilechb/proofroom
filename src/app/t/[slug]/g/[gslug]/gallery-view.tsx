"use client";

import { useState, useTransition } from "react";
import { Lightbox, type LightboxPhoto } from "@/components/ui/lightbox";
import { cx } from "@/components/ui";
import { addNoteAction, toggleFavoriteAction } from "./actions";

export type ClientPhoto = { id: string; filename: string; width: number | null; height: number | null; favorite: boolean; note: string | null };

export function GalleryView({ galleryId, photos: initial, allowComments, favoritesLimit }: { galleryId: string; photos: ClientPhoto[]; allowComments: boolean; favoritesLimit: number | null }) {
  const [photos, setPhotos] = useState(initial);
  const [index, setIndex] = useState<number | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [, startTransition] = useTransition();

  const favoriteCount = photos.filter((p) => p.favorite).length;
  const shown = onlyFavorites ? photos.filter((p) => p.favorite) : photos;

  const toggle = (photoId: string) => {
    setPhotos((list) => list.map((p) => (p.id === photoId ? { ...p, favorite: !p.favorite } : p)));
    const next = !photos.find((p) => p.id === photoId)?.favorite;
    startTransition(() => { void toggleFavoriteAction(galleryId, photoId, next); });
  };

  const lightboxPhotos: LightboxPhoto[] = shown.map((p) => ({ id: p.id, src: `/api/photo/${p.id}?size=web`, alt: p.filename, width: p.width, height: p.height }));

  return (
    <div>
      {allowComments ? (
        <div className="sticky top-0 z-20 -mx-5 sm:-mx-8 mb-6 border-b border-[var(--site-line)] bg-[var(--site-bg)]/90 backdrop-blur px-5 sm:px-8 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-[var(--site-ink-2)]">
            {favoriteCount} favorited{favoritesLimit ? ` of ${favoritesLimit} included` : ""}
            {favoritesLimit && favoriteCount > favoritesLimit ? <span className="text-[var(--site-accent)]"> · {favoriteCount - favoritesLimit} extra</span> : null}
          </p>
          <button type="button" onClick={() => setOnlyFavorites((v) => !v)} className={cx("rounded-full border border-[var(--site-line)] px-3 py-1 text-sm", onlyFavorites && "bg-[var(--site-primary)] text-[var(--site-primary-ink)] border-transparent")}>
            {onlyFavorites ? "Show all" : "Favorites"}
          </button>
        </div>
      ) : null}

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {shown.map((p, i) => (
          <li key={p.id} className="relative group">
            <button type="button" onClick={() => setIndex(i)} className="block w-full aspect-square overflow-hidden rounded-lg bg-[var(--site-bg-2)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photo/${p.id}?size=thumb`} alt={p.filename} loading="lazy" className="h-full w-full object-cover" />
            </button>
            {allowComments ? (
              <button type="button" onClick={() => toggle(p.id)} aria-pressed={p.favorite} aria-label={p.favorite ? "Remove favorite" : "Add favorite"} className="absolute top-2 right-2 text-lg drop-shadow">
                <span className={p.favorite ? "text-red-500" : "text-white/90"}>{p.favorite ? "♥" : "♡"}</span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <Lightbox
        photos={lightboxPhotos}
        index={index}
        onClose={() => setIndex(null)}
        onIndexChange={setIndex}
        onFavorite={allowComments ? (photo) => toggle(photo.id) : undefined}
        actions={allowComments ? (photo) => <NoteBox galleryId={galleryId} photoId={photo.id} favorite={photos.find((p) => p.id === photo.id)?.favorite ?? false} onToggle={() => toggle(photo.id)} /> : undefined}
      />
    </div>
  );
}

function NoteBox({ galleryId, photoId, favorite, onToggle }: { galleryId: string; photoId: string; favorite: boolean; onToggle: () => void }) {
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 w-full max-w-md">
      <button type="button" onClick={onToggle} className="self-start rounded-full border border-white/30 px-3 py-1 text-sm text-white">{favorite ? "♥ Favorited" : "♡ Favorite"}</button>
      {sent ? (
        <p className="text-sm text-white/80">Note sent to the photographer.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            start(async () => {
              const res = await addNoteAction(galleryId, photoId, body, name);
              if (res.ok) { setSent(true); setBody(""); }
            });
          }}
          className="flex flex-col gap-2"
        >
          {!name ? <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-white placeholder:text-white/50" /> : null}
          <div className="flex gap-2">
            <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Leave a note on this photo" className="flex-1 rounded-md bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-white placeholder:text-white/50" />
            <button type="submit" disabled={pending || !body.trim()} className="rounded-md bg-white text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50">Send</button>
          </div>
        </form>
      )}
    </div>
  );
}
