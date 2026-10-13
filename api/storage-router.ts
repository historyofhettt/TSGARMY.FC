import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { storage } from "./lib/storage";
import { getDb } from "./queries/connection";
import { media } from "../db/schema";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const MAGIC_BYTES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
  "image/avif": [0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70],
};

const VIDEO_MAGIC_BYTES: Record<string, number[]> = {
  "video/mp4": [0x00, 0x00, 0x00],
  "video/webm": [0x1a, 0x45, 0xdf, 0xa3],
  "video/quicktime": [0x00, 0x00, 0x00],
};

function validateMagicBytes(contentType: string, bytes: Uint8Array): boolean {
  const signatures = MAGIC_BYTES[contentType] ?? VIDEO_MAGIC_BYTES[contentType];
  if (!signatures) {
    return false;
  }
  return bytes.slice(0, signatures.length).every((b, i) => b === signatures[i]);
}

function sanitizeFilename(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|]/g, "_").replace(/^\.+/, "").slice(0, 200);
  const dotIndex = safe.lastIndexOf(".");
  const nameOnly = dotIndex > 0 ? safe.slice(0, dotIndex) : safe;
  return nameOnly || "upload";
}

export const storageRouter = createRouter({
  /** Admin image upload → platform object storage + media library row. */
  upload: adminQuery
    .input(
      z.object({
        name: z.string().min(1).max(400),
        contentBase64: z.string(),
        contentType: z.string().max(128).optional(),
        category: z
          .enum([
            "team-logos",
            "player-photos",
            "owner-photos",
            "tournament-logos",
            "point-tables",
            "achievement-images",
            "card-artwork",
            "user-avatars",
            "team-media",
            "other",
          ])
          .default("other"),
      }),
    )
    .mutation(async ({ input }) => {
      const bytes = Uint8Array.from(Buffer.from(input.contentBase64, "base64"));
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Image is too large. Maximum size is 8 MB.",
        });
      }
      const contentType = input.contentType ?? "image/png";
      if (!ALLOWED_TYPES.has(contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only image files (PNG, JPG, WebP, GIF, AVIF) are allowed.",
        });
      }
      if (!validateMagicBytes(contentType, bytes)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File content does not match the declared type.",
        });
      }
      const extension = Object.keys(MAGIC_BYTES).find((k) => k === contentType)?.split("/")[1] ?? "png";
      const safeName = `${sanitizeFilename(input.name)}.${extension}`;
      const saved = await storage.uploadFile({
        fileContent: bytes,
        fileName: `tsg/${input.category}/${Date.now()}-${safeName}`,
        contentType,
      });
      await getDb().insert(media).values({
        fileKey: saved.key,
        fileName: safeName,
        category: input.category,
        size: saved.size,
        contentType,
      });
      const { url } = await storage.getPresignedUrl({ key: saved.key });
      return { key: saved.key, size: saved.size, url };
    }),

  /** Mint a short-lived URL for a key (rendering / download). */
  url: publicQuery
    .input(z.object({ key: z.string().max(512), download: z.boolean().optional() }))
    .query(async ({ input }) => ({
      url: (
        await storage.getPresignedUrl({ key: input.key, download: input.download })
      ).url,
    })),

  /** Admin media-gallery upload (photo or video) → platform object storage. */
  uploadMedia: adminQuery
    .input(
      z.object({
        name: z.string().min(1).max(400),
        contentBase64: z.string(),
        contentType: z.string().max(128).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const bytes = Uint8Array.from(Buffer.from(input.contentBase64, "base64"));
      const contentType = input.contentType ?? "application/octet-stream";
      const isVideo = ALLOWED_VIDEO_TYPES.has(contentType);
      const isImage = ALLOWED_TYPES.has(contentType);
      if (!isVideo && !isImage) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Only image files (PNG, JPG, WebP, GIF, AVIF) and video files (MP4, WebM, MOV) are allowed.",
        });
      }
      if (!validateMagicBytes(contentType, bytes)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File content does not match the declared type.",
        });
      }
      const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (bytes.byteLength > maxBytes) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File is too large. Maximum size is ${maxBytes / 1024 / 1024} MB.`,
        });
      }
      const extension = isImage
        ? (Object.keys(MAGIC_BYTES).find((k) => k === contentType)?.split("/")[1] ?? "png")
        : (contentType.split("/")[1] ?? "bin");
      const safeName = `${sanitizeFilename(input.name)}.${extension}`;
      const saved = await storage.uploadMediaFile({
        fileContent: bytes,
        fileName: safeName,
        contentType,
      });
      const { url } = await storage.getPresignedUrl({ key: saved.key });
      return { key: saved.key, size: saved.size, url, contentType: saved.contentType };
    }),
});
