/** Avatars are stored as small square images inside the profile (no file storage needed, and they sync with it). */
export const AVATAR_SIZE = 256;
/** Bigger photos are refused before decoding (a phone camera picture is usually 2–8 MB). */
export const AVATAR_MAX_FILE = 15 * 1024 * 1024;

/** Crops an image to a centred square and scales it to AVATAR_SIZE, as a compact data URL. */
export function squareAvatar(source: CanvasImageSource, width: number, height: number, type: 'image/jpeg' | 'image/png' = 'image/jpeg'): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = AVATAR_SIZE;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas unavailable');
  const side = Math.min(width, height);
  g.fillStyle = '#0b1220'; // transparent PNGs get the ship's dark backdrop instead of black JPEG corners
  g.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  g.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  return canvas.toDataURL(type, 0.86);
}

/** Reads a picked image file into a square avatar. */
export async function avatarFromFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG, WebP or GIF).');
  if (file.size > AVATAR_MAX_FILE) throw new Error('That image is over 15 MB — please pick a smaller one.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error('That image could not be opened — try a JPG or PNG.');
    });
    return squareAvatar(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}
