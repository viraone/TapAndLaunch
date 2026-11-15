import { fitWithin } from "./fit-within";

export const CHAT_PHOTO_MAX_SIDE = 1600;

/** Shrinks a phone photo to at most 1600 px on its longer side and re-saves it as a JPEG (about 300 KB), in the browser. Rejects when the browser cannot read the picture. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const { width, height } = fitWithin(image.naturalWidth, image.naturalHeight, CHAT_PHOTO_MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("Could not shrink the photo");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
