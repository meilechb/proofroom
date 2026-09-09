"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

/**
 * Lightbox (plan 4.23): keyboard (arrows, Escape, F), swipe, double-tap and
 * pinch zoom, optional slideshow, and a slot for favorite, note and download
 * buttons. Images are plain <img> so private photo routes work unchanged.
 */
export type LightboxPhoto = { id: string; src: string; alt: string; width?: number | null; height?: number | null };

export function Lightbox({ photos, index, onClose, onIndexChange, onFavorite, actions, slideshowMs = 4000 }: {
  photos: LightboxPhoto[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  onFavorite?: (photo: LightboxPhoto) => void;
  actions?: (photo: LightboxPhoto) => ReactNode;
  slideshowMs?: number;
}) {
  const open = index !== null && index >= 0 && index < photos.length;
  const photo = open ? photos[index!] : null;
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const touch = useRef<{ x: number; y: number; dist: number; time: number } | null>(null);
  const lastTap = useRef(0);
  const previousFocus = useRef<Element | null>(null);

  const go = useCallback((delta: number) => {
    if (!open) return;
    setZoom(1);
    onIndexChange((index! + delta + photos.length) % photos.length);
  }, [open, index, photos.length, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if ((e.key === "f" || e.key === "F") && photo && onFavorite) onFavorite(photo);
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      (previousFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [open, go, onClose, onFavorite, photo]);

  useEffect(() => {
    if (!open || !playing) return;
    const t = setInterval(() => go(1), slideshowMs);
    return () => clearInterval(t);
  }, [open, playing, go, slideshowMs]);

  if (!open || !photo) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col" role="dialog" aria-modal="true" aria-label={`Photo ${index! + 1} of ${photos.length}`}>
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="text-white/70">{index! + 1} / {photos.length}</span>
        <div className="flex items-center gap-1">
          <button type="button" className="p-2 rounded-md hover:bg-white/10" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause slideshow" : "Play slideshow"}>{playing ? <Icon.X /> : <Icon.Play />}</button>
          {onFavorite ? <button type="button" className="p-2 rounded-md hover:bg-white/10" onClick={() => onFavorite(photo)} aria-label="Toggle favorite"><Icon.Heart /></button> : null}
          {actions?.(photo)}
          <button type="button" className="p-2 rounded-md hover:bg-white/10" onClick={onClose} aria-label="Close" autoFocus><Icon.X /></button>
        </div>
      </div>
      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden touch-none"
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            const [a, b] = [e.touches[0], e.touches[1]];
            touch.current = { x: 0, y: 0, dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), time: Date.now() };
          } else {
            touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dist: 0, time: Date.now() };
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && touch.current?.dist) {
            const [a, b] = [e.touches[0], e.touches[1]];
            const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            setZoom((z) => Math.min(4, Math.max(1, z * (d / touch.current!.dist))));
            touch.current.dist = d;
          }
        }}
        onTouchEnd={(e) => {
          const t = touch.current;
          if (!t || t.dist) return;
          const dx = e.changedTouches[0].clientX - t.x;
          const dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 50 && Math.abs(dy) < 60 && zoom === 1) go(dx < 0 ? 1 : -1);
          else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
            const now = Date.now();
            if (now - lastTap.current < 300) setZoom((z) => (z > 1 ? 1 : 2));
            lastTap.current = now;
          }
        }}
        onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
      >
        <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 hidden sm:block" onClick={() => go(-1)} aria-label="Previous"><Icon.ChevronLeft /></button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={photo.id} src={photo.src} alt={photo.alt} className={cx("max-h-full max-w-full object-contain select-none transition-transform", zoom > 1 && "cursor-zoom-out")} style={{ transform: `scale(${zoom})` }} draggable={false} />
        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/40 hover:bg-black/60 hidden sm:block" onClick={() => go(1)} aria-label="Next"><Icon.ChevronRight /></button>
      </div>
      <div className="px-4 py-3 text-xs text-white/60 truncate">{photo.alt}</div>
    </div>
  );
}
