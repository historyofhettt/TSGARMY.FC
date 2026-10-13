import fs from "fs";
import path from "path";

const UPLOAD_ROOT = path.resolve(process.cwd(), "public/uploads");
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function guessContentType(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "application/octet-stream";
  const ext = fileName.slice(dot).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
  };
  return map[ext] ?? "application/octet-stream";
}

export class LocalStorage {
  async uploadFile(input: { fileContent: Uint8Array | string; fileName: string; contentType?: string }) {
    const body = typeof input.fileContent === "string" ? new TextEncoder().encode(input.fileContent) : input.fileContent;
    if (body.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image is too large. Maximum size is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
    }
    const contentType = input.contentType ?? guessContentType(input.fileName);
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new Error("Only image files (PNG, JPG, WebP, GIF, AVIF, SVG) are allowed.");
    }
    const safeName = input.fileName.replace(/[\\/]/g, "_").slice(0, 200);
    const stamp = Date.now();
    const key = `tsg/${stamp}-${safeName}`;
    const dir = path.join(UPLOAD_ROOT, "tsg");
    ensureDir(dir);
    const fullPath = path.join(dir, `${stamp}-${safeName}`);
    fs.writeFileSync(fullPath, body);
    const size = body.byteLength;
    return { key, fileName: safeName, size, contentType, reviewStatus: "active" as const };
  }

  /**
   * Upload a media-gallery file (photo or video). Videos are allowed
   * up to MAX_VIDEO_BYTES; images up to MAX_IMAGE_BYTES.
   */
  async uploadMediaFile(input: { fileContent: Uint8Array | string; fileName: string; contentType?: string }) {
    const body = typeof input.fileContent === "string" ? new TextEncoder().encode(input.fileContent) : input.fileContent;
    const contentType = input.contentType ?? guessContentType(input.fileName);
    const isVideo = ALLOWED_VIDEO_TYPES.has(contentType);
    const isImage = ALLOWED_TYPES.has(contentType);
    if (!isVideo && !isImage) {
      throw new Error("Only image (PNG, JPG, WebP, GIF, AVIF, SVG) and video (MP4, WebM, MOV) files are allowed.");
    }
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (body.byteLength > maxBytes) {
      throw new Error(`File is too large. Maximum size is ${maxBytes / 1024 / 1024} MB.`);
    }
    const safeName = input.fileName.replace(/[\\/]/g, "_").slice(0, 200);
    const stamp = Date.now();
    const key = `tsg/media/${stamp}-${safeName}`;
    const dir = path.join(UPLOAD_ROOT, "tsg", "media");
    ensureDir(dir);
    const fullPath = path.join(dir, `${stamp}-${safeName}`);
    fs.writeFileSync(fullPath, body);
    const size = body.byteLength;
    return { key, fileName: safeName, size, contentType };
  }

  async getPresignedUrl(input: { key: string; download?: boolean }): Promise<{ key: string; url: string }> {
    const url = `/uploads/${input.key}`;
    return { key: input.key, url };
  }

  async getPresignedUrls(input: { keys: string[]; download?: boolean }): Promise<{ urls: { key: string; url: string }[]; failures: { key: string; message: string }[] }> {
    return {
      urls: input.keys.map((k) => ({ key: k, url: `/uploads/${k}` })),
      failures: [],
    };
  }

  async deleteFile(input: { fileKey: string }): Promise<boolean> {
    const fullPath = path.join(UPLOAD_ROOT, input.fileKey);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return true;
  }

  /** Read raw file bytes by storage key, or null if missing. */
  async readBytes(fileKey: string): Promise<Uint8Array | null> {
    const fullPath = path.join(UPLOAD_ROOT, fileKey);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath);
  }
}

export const storage = new LocalStorage();
