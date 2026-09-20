// Re-encode in the browser so camera metadata and original file names are not uploaded.
export async function prepareMeme(file) {
  if (!file || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) throw new Error("Choose a PNG, JPG, WebP or GIF image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40000000) throw new Error("That image is too large. Choose a smaller version.");
    const ratio = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.65, 0.45]) {
      const url = canvas.toDataURL("image/webp", quality);
      if (!url.startsWith("data:image/webp;base64,")) throw new Error("This browser cannot prepare meme uploads. Try a newer browser.");
      if (url.length < 262100) return url;
    }
    throw new Error("That meme is too detailed. Try a smaller or simpler image.");
  } finally { bitmap.close(); }
}
