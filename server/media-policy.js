export const MAX_IMAGE_BYTES = 192 * 1024;
export const MAX_POST_BYTES = 270 * 1024;
export const IMAGE_ERROR = "Use a small still image through the meme upload button (192 KB after resizing).";

// Only a bounded, non-animated WebP container is accepted. No SVG/HTML, metadata,
// external URLs or arbitrary files are served, even if a client bypasses the UI.
export function decodeMeme(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error(IMAGE_ERROR);
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  if (bytes.length < 20 || bytes.length > MAX_IMAGE_BYTES) throw new Error(IMAGE_ERROR);
  const view = new DataView(bytes.buffer);
  const tag = start => String.fromCharCode(...bytes.slice(start, start + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WEBP" || view.getUint32(4, true) + 8 !== bytes.length) throw new Error(IMAGE_ERROR);
  let frames = 0;
  for (let pos = 12; pos < bytes.length;) {
    if (pos + 8 > bytes.length) throw new Error(IMAGE_ERROR);
    const kind = tag(pos), size = view.getUint32(pos + 4, true), p = pos + 8;
    if (p + size > bytes.length || !["VP8 ", "VP8L", "VP8X", "ALPH"].includes(kind)) throw new Error(IMAGE_ERROR);
    let width = 0, height = 0;
    if (kind === "VP8X") {
      if (size !== 10 || (bytes[p] & ~16)) throw new Error(IMAGE_ERROR);
      width = 1 + bytes[p + 4] + (bytes[p + 5] << 8) + (bytes[p + 6] << 16);
      height = 1 + bytes[p + 7] + (bytes[p + 8] << 8) + (bytes[p + 9] << 16);
    } else if (kind === "VP8 ") {
      if (size < 10 || bytes[p+3] !== 0x9d || bytes[p+4] !== 1 || bytes[p+5] !== 0x2a) throw new Error(IMAGE_ERROR);
      width = view.getUint16(p+6,true) & 0x3fff; height = view.getUint16(p+8,true) & 0x3fff; frames++;
    } else if (kind === "VP8L") {
      if (size < 5 || bytes[p] !== 0x2f) throw new Error(IMAGE_ERROR);
      const bits = view.getUint32(p+1,true);
      width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; frames++;
    }
    if (kind !== "ALPH" && (!width || !height || width > 1280 || height > 1280 || width * height > 1638400)) throw new Error(IMAGE_ERROR);
    pos = p + size + (size % 2);
    if (pos > bytes.length) throw new Error(IMAGE_ERROR);
  }
  if (frames !== 1) throw new Error(IMAGE_ERROR);
  return bytes;
}
