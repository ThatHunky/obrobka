export type SupportedMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif';

function startsWith(bytes: Uint8Array, offset: number, signature: readonly number[]): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

/**
 * Визначає формат за сигнатурою байтів.
 * Розширення файлу брехливе — браузери й месенджери регулярно
 * віддають HEIC під іменем .jpg.
 */
export function sniffMime(bytes: Uint8Array): SupportedMime | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes, 8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
  if (startsWith(bytes, 4, [0x66, 0x74, 0x79, 0x70]) &&
      startsWith(bytes, 8, [0x61, 0x76, 0x69, 0x66])) return 'image/avif';
  return null;
}
