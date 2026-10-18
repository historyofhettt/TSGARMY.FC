import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, checkS3Enabled } from "./env";

function resolveUploadRoot(): string {
  if (env.isProduction) {
    return path.resolve(process.cwd(), "dist", "public", "uploads");
  }
  return path.resolve(process.cwd(), "public", "uploads");
}

export const UPLOAD_ROOT = resolveUploadRoot();
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

if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
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

export interface StorageResult {
  key: string;
  fileName: string;
  size: number;
  contentType: string;
  reviewStatus?: "active" | "pending";
}

export interface StorageProvider {
  uploadFile(input: { fileContent: Uint8Array | string; fileName: string; contentType?: string }): Promise<StorageResult>;
  uploadMediaFile(input: { fileContent: Uint8Array | string; fileName: string; contentType?: string }): Promise<StorageResult>;
  getPresignedUrl(input: { key: string; download?: boolean }): Promise<{ key: string; url: string }>;
  getPresignedUrls(input: { keys: string[]; download?: boolean }): Promise<{ urls: { key: string; url: string }[]; failures: { key: string; message: string }[] }>;
  deleteFile(input: { fileKey: string }): Promise<boolean>;
  readBytes(fileKey: string): Promise<Uint8Array | null>;
}

export class S3StorageProvider implements StorageProvider {
  private s3: S3Client | null = null;

  private getS3Bucket(): string {
    const bucket = process.env.S3_BUCKET || env.s3Bucket;
    if (!bucket) {
      throw new Error("S3 bucket is not configured. Set S3_BUCKET.");
    }
    return bucket;
  }

  private getS3Region(): string {
    return process.env.AWS_REGION || process.env.S3_REGION || env.awsRegion || "us-east-1";
  }

  private getS3Endpoint(): string | undefined {
    return process.env.S3_ENDPOINT || env.s3Endpoint || undefined;
  }

  private getS3ForcePathStyle(): boolean {
    const val = process.env.S3_FORCE_PATH_STYLE;
    if (val !== undefined) return val === "true";
    return env.s3ForcePathStyle;
  }

  private getCredentials(): { accessKeyId: string; secretAccessKey: string } | null {
    if (!checkS3Enabled()) return null;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || env.awsAccessKeyId;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || env.awsSecretAccessKey;
    if (!accessKeyId || !secretAccessKey) return null;
    return { accessKeyId, secretAccessKey };
  }

  private getClient(): S3Client {
    if (!this.s3) {
      const creds = this.getCredentials();
      if (!creds) {
        throw new Error("S3 storage is not configured. Set S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.");
      }
      this.s3 = new S3Client({
        region: this.getS3Region(),
        endpoint: this.getS3Endpoint(),
        forcePathStyle: this.getS3ForcePathStyle(),
        credentials: {
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
        },
      });
    }
    return this.s3;
  }

  private async validateFile(body: Uint8Array, contentType: string, isVideo: boolean): Promise<void> {
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (body.byteLength > maxBytes) {
      throw new Error(`File is too large. Maximum size is ${maxBytes / 1024 / 1024} MB.`);
    }
    const allowed = isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_TYPES;
    if (!allowed.has(contentType)) {
      throw new Error(`Only ${isVideo ? "video" : "image"} files are allowed.`);
    }
  }

  async uploadFile(input: { fileContent: Uint8Array | string; fileName: string; contentType?: string }): Promise<StorageResult> {
    const body = typeof input.fileContent === "string" ? new TextEncoder().encode(input.fileContent) : input.fileContent;
    const contentType = input.contentType ?? guessContentType(input.fileName);
    await this.validateFile(body, contentType, false);
    const safeName = input.fileName.replace(/[\\/]/g, "_").replace(/\.\./g, "_").slice(0, 200);
    const stamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const key = `tsg/${stamp}-${randomSuffix}-${safeName}`;
    const s3 = this.getClient();
    await s3.send(
      new PutObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      }),
    );
    return { key, fileName: safeName, size: body.byteLength, contentType, reviewStatus: "active" };
  }

  async uploadMediaFile(input: { fileContent: Uint8Array | string; fileName: string; contentType?: string }): Promise<StorageResult> {
    const body = typeof input.fileContent === "string" ? new TextEncoder().encode(input.fileContent) : input.fileContent;
    const contentType = input.contentType ?? guessContentType(input.fileName);
    const isVideo = ALLOWED_VIDEO_TYPES.has(contentType);
    await this.validateFile(body, contentType, isVideo);
    const safeName = input.fileName.replace(/[\\/]/g, "_").replace(/\.\./g, "_").slice(0, 200);
    const stamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const key = `tsg/media/${stamp}-${randomSuffix}-${safeName}`;
    const s3 = this.getClient();
    await s3.send(
      new PutObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      }),
    );
    return { key, fileName: safeName, size: body.byteLength, contentType };
  }

  async getPresignedUrl(input: { key: string; download?: boolean }): Promise<{ key: string; url: string }> {
    const s3 = this.getClient();
    const command = new GetObjectCommand({
      Bucket: this.getS3Bucket(),
      Key: input.key,
      ...(input.download && { ResponseContentDisposition: `attachment; filename="${input.key.split("/").pop()}"` }),
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return { key: input.key, url };
  }

  async getPresignedUrls(input: { keys: string[]; download?: boolean }): Promise<{ urls: { key: string; url: string }[]; failures: { key: string; message: string }[] }> {
    const s3 = this.getClient();
    const urls: { key: string; url: string }[] = [];
    const failures: { key: string; message: string }[] = [];
    for (const key of input.keys) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.getS3Bucket(),
          Key: key,
          ...(input.download && { ResponseContentDisposition: `attachment; filename="${key.split("/").pop()}"` }),
        });
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
        urls.push({ key, url });
      } catch (err) {
        failures.push({ key, message: err instanceof Error ? err.message : String(err) });
      }
    }
    return { urls, failures };
  }

  async deleteFile(input: { fileKey: string }): Promise<boolean> {
    const s3 = this.getClient();
    await s3.send(
      new DeleteObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: input.fileKey,
      }),
    );
    return true;
  }

  async readBytes(fileKey: string): Promise<Uint8Array | null> {
    const s3 = this.getClient();
    try {
      const result = await s3.send(
        new GetObjectCommand({
          Bucket: this.getS3Bucket(),
          Key: fileKey,
        }),
      );
      if (!result.Body) return null;
      const chunks: Buffer[] = [];
      const body = result.Body as AsyncIterable<Uint8Array>;
      for await (const chunk of body) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (err) {
      if (typeof err === "object" && err !== null) {
        const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
      }
      throw err;
    }
  }
}

export class LocalStorage implements StorageProvider {
  async uploadFile(input: { fileContent: Uint8Array | string; fileName: string; contentType?: string }): Promise<StorageResult> {
    const body = typeof input.fileContent === "string" ? new TextEncoder().encode(input.fileContent) : input.fileContent;
    if (body.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image is too large. Maximum size is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
    }
    const contentType = input.contentType ?? guessContentType(input.fileName);
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new Error("Only image files (PNG, JPG, WebP, GIF, AVIF, SVG) are allowed.");
    }
    const safeName = input.fileName.replace(/[\\/]/g, "_").replace(/\.\./g, "_").slice(0, 200);
    const stamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const key = `tsg/${stamp}-${randomSuffix}-${safeName}`;
    const dir = path.join(UPLOAD_ROOT, "tsg");
    ensureDir(dir);
    const fullPath = path.join(dir, `${stamp}-${randomSuffix}-${safeName}`);
    fs.writeFileSync(fullPath, body);
    const size = body.byteLength;
    return { key, fileName: safeName, size, contentType, reviewStatus: "active" as const };
  }

  async uploadMediaFile(input: { fileContent: Uint8Array | string; fileName: string; contentType?: string }): Promise<StorageResult> {
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
    const safeName = input.fileName.replace(/[\\/]/g, "_").replace(/\.\./g, "_").slice(0, 200);
    const stamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const key = `tsg/media/${stamp}-${randomSuffix}-${safeName}`;
    const dir = path.join(UPLOAD_ROOT, "tsg", "media");
    ensureDir(dir);
    const fullPath = path.join(dir, `${stamp}-${randomSuffix}-${safeName}`);
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
    const fullPath = path.join(UPLOAD_ROOT, input.fileKey.replace(/^\//, ""));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return true;
  }

  async readBytes(fileKey: string): Promise<Uint8Array | null> {
    const fullPath = path.join(UPLOAD_ROOT, fileKey.replace(/^\//, ""));
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath);
  }
}

export function getStorage(): StorageProvider {
  if (checkS3Enabled()) {
    return new S3StorageProvider();
  }
  if (env.isProduction) {
    console.warn(
      "[storage] S3_BUCKET or AWS credentials are not set — falling back to local filesystem storage. " +
        "Uploaded files will be written to the ephemeral filesystem (lost on restart in Render).",
    );
  }
  return new LocalStorage();
}

export const storage: StorageProvider = getStorage();
