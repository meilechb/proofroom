import { Zip, ZipPassThrough } from "fflate";

/**
 * Streaming zip of already-compressed images (JPEGs do not shrink under
 * DEFLATE, so entries are stored as-is). Produces a web ReadableStream that a
 * route handler can return directly, so a 300-photo gallery never sits in
 * memory at once. Pure module: no server-only import so it can be unit tested.
 */

export type ZipEntry = { name: string; read: () => Promise<Uint8Array | ReadableStream<Uint8Array>> };

/** Makes filenames unique inside the archive: a.jpg, a (2).jpg, a (3).jpg. */
export function dedupeNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const name = raw.trim() || "photo.jpg";
    const key = name.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) return name;
    const dot = name.lastIndexOf(".");
    return dot > 0 ? `${name.slice(0, dot)} (${count + 1})${name.slice(dot)}` : `${name} (${count + 1})`;
  });
}

export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  const names = dedupeNames(entries.map((e) => e.name));
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let failed: unknown = null;
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          failed = err;
          controller.error(err);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      try {
        for (let i = 0; i < entries.length; i++) {
          if (failed) return;
          const file = new ZipPassThrough(names[i]);
          zip.add(file);
          const data = await entries[i].read();
          if (data instanceof Uint8Array) {
            file.push(data, true);
          } else {
            const reader = data.getReader();
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              file.push(value, false);
            }
            file.push(new Uint8Array(0), true);
          }
        }
        zip.end();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
