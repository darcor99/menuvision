const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.88;

/**
 * Resizes and re-encodes a File to JPEG on the client using Canvas.
 * Returns the original file unchanged if it is already small or if
 * the browser cannot decode it (e.g. an unsupported exotic format).
 */
export function compressImage(file: File): Promise<File> {
  // Nothing to gain on tiny files
  if (file.size < 400_000) return Promise.resolve(file);

  return new Promise<File>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { naturalWidth: w, naturalHeight: h } = img;
      const longest = Math.max(w, h);
      const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
      const targetW = Math.round(w * scale);
      const targetH = Math.round(h * scale);

      // Already within dimension limit and not excessively large
      if (scale === 1 && file.size < 1_000_000) {
        resolve(file);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, targetW, targetH);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg" }
          );
          // Never hand back a file larger than what came in
          resolve(compressed.size < file.size ? compressed : file);
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fall back to original on decode failure
    };

    img.src = objectUrl;
  });
}
