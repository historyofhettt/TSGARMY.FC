import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { S3StorageProvider, guessContentType } from "./lib/storage";

function mockS3Client(mockSend: ReturnType<typeof vi.fn>) {
  type MockS3Client = { send: ReturnType<typeof vi.fn> };
  const MockS3Client = vi.fn().mockImplementation(function (this: MockS3Client) {
    this.send = mockSend;
  });

  type MockedCommand = { input: Record<string, unknown> };

  vi.doMock("@aws-sdk/client-s3", () => ({
    S3Client: MockS3Client,
    PutObjectCommand: function (this: MockedCommand, input: Record<string, unknown>) {
      this.input = input;
    },
    GetObjectCommand: function (this: MockedCommand, input: Record<string, unknown>) {
      this.input = input;
    },
    DeleteObjectCommand: function (this: MockedCommand, input: Record<string, unknown>) {
      this.input = input;
    },
  }));

  vi.doMock("@aws-sdk/s3-request-presigner", () => ({
    getSignedUrl: vi.fn().mockResolvedValue("https://signed-url.example.com/test-key?signature=abc"),
  }));
}

describe("S3StorageProvider", () => {
  let provider: S3StorageProvider;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    process.env.AWS_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.S3_BUCKET = "test-bucket";
    process.env.AWS_REGION = "us-east-1";
    process.env.S3_ENDPOINT = "";

    mockSend = vi.fn();
    mockS3Client(mockSend);
    vi.resetModules();

    const { S3StorageProvider: S3Provider } = await import("./lib/storage");
    provider = new S3Provider();
  });

  afterEach(() => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
    delete process.env.AWS_REGION;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_FORCE_PATH_STYLE;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("uploadFile sends PutObject to S3 with correct bucket/key", async () => {
    mockSend.mockResolvedValue({});
    const result = await provider.uploadFile({
      fileContent: Buffer.from("fake-image"),
      fileName: "test.png",
      contentType: "image/png",
    });
    expect(result.key).toMatch(/^tsg\/\d+-[a-z0-9]+-test\.png$/);
    expect(result.fileName).toBe("test.png");
    expect(result.contentType).toBe("image/png");
    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(call.input.Bucket).toBe("test-bucket");
    expect(call.input.Key).toBe(result.key);
    expect(call.input.CacheControl).toBe("public, max-age=31536000");
  });

  it("uploadFile rejects non-image content types", async () => {
    await expect(
      provider.uploadFile({
        fileContent: Buffer.from("data"),
        fileName: "test.txt",
        contentType: "text/plain",
      }),
    ).rejects.toThrow("Only image files");
  });

  it("uploadFile rejects oversized images", async () => {
    const largeContent = Buffer.alloc(9 * 1024 * 1024, 0);
    await expect(
      provider.uploadFile({
        fileContent: largeContent,
        fileName: "big.png",
        contentType: "image/png",
      }),
    ).rejects.toThrow("too large");
  });

  it("uploadFile sanitizes path separators in filename", async () => {
    mockSend.mockResolvedValue({});
    const result = await provider.uploadFile({
      fileContent: Buffer.from("data"),
      fileName: "../../../etc/passwd.png",
      contentType: "image/png",
    });
    expect(result.fileName).not.toContain("/");
    expect(result.fileName).not.toContain("\\");
    expect(result.fileName).not.toContain("..");
    expect(result.key).not.toContain("..");
  });

  it("uploadMediaFile accepts video content types", async () => {
    mockSend.mockResolvedValue({});
    const result = await provider.uploadMediaFile({
      fileContent: Buffer.from("fake-video"),
      fileName: "test.mp4",
      contentType: "video/mp4",
    });
    expect(result.key).toMatch(/^tsg\/media\/\d+-[a-z0-9]+-test\.mp4$/);
    expect(result.contentType).toBe("video/mp4");
  });

  it("uploadMediaFile rejects unsupported content types", async () => {
    await expect(
      provider.uploadMediaFile({
        fileContent: Buffer.from("data"),
        fileName: "test.txt",
        contentType: "text/plain",
      }),
    ).rejects.toThrow("Only image");
  });

  it("getPresignedUrl returns a presigned URL", async () => {
    const result = await provider.getPresignedUrl({ key: "tsg/test.png" });
    expect(result.key).toBe("tsg/test.png");
    expect(result.url).toContain("signed-url.example.com");
  });

  it("getPresignedUrls returns presigned URLs for all valid keys", async () => {
    const result = await provider.getPresignedUrls({ keys: ["tsg/a.png", "tsg/b.png"] });
    expect(result.urls).toHaveLength(2);
    expect(result.failures).toHaveLength(0);
    expect(result.urls[0].key).toBe("tsg/a.png");
    expect(result.urls[1].key).toBe("tsg/b.png");
  });

  it("getPresignedUrls returns failures for keys that error", async () => {
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    (getSignedUrl as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("S3 error"));
    const result = await provider.getPresignedUrls({ keys: ["tsg/a.png", "tsg/b.png"] });
    expect(result.urls).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].key).toBe("tsg/a.png");
    expect(result.failures[0].message).toBe("S3 error");
  });

  it("deleteFile sends DeleteObjectCommand to S3", async () => {
    mockSend.mockResolvedValue({});
    const result = await provider.deleteFile({ fileKey: "tsg/test.png" });
    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("readBytes returns null for missing keys (NoSuchKey)", async () => {
    const err: Error & { name: string } = new Error("Not Found");
    err.name = "NoSuchKey";
    mockSend.mockRejectedValue(err);
    const result = await provider.readBytes("tsg/missing.png");
    expect(result).toBeNull();
  });

  it("readBytes returns file bytes on success", async () => {
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from("hello");
        yield Buffer.from("world");
      },
    };
    mockSend.mockResolvedValue({ Body: mockStream });
    const result = await provider.readBytes("tsg/test.png");
    expect(result).toBeInstanceOf(Buffer);
    expect(result?.toString()).toBe("helloworld");
  });

  it("readBytes rethrows unexpected errors", async () => {
    mockSend.mockRejectedValue(new Error("Network error"));
    await expect(provider.readBytes("tsg/test.png")).rejects.toThrow("Network error");
  });

  it("throws when S3 is not configured (no credentials)", async () => {
    const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
    const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const originalBucket = process.env.S3_BUCKET;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
    vi.resetModules();
    const { checkS3Enabled } = await import("./lib/env");
    expect(checkS3Enabled()).toBe(false);
    process.env.AWS_ACCESS_KEY_ID = originalAccessKey;
    process.env.AWS_SECRET_ACCESS_KEY = originalSecretKey;
    process.env.S3_BUCKET = originalBucket;
  });
});

describe("getStorage", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
    vi.restoreAllMocks();
  });

  it("returns LocalStorage when S3 env vars are not set", async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
    const { getStorage, LocalStorage } = await import("./lib/storage");
    const storage = getStorage();
    expect(storage).toBeInstanceOf(LocalStorage);
  });

  it("returns S3StorageProvider when S3 env vars are set", async () => {
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
    process.env.S3_BUCKET = "test-bucket";
    mockS3Client(vi.fn());
    const { getStorage, S3StorageProvider } = await import("./lib/storage");
    const storage = getStorage();
    expect(storage).toBeInstanceOf(S3StorageProvider);
  });

  it("returns LocalStorage when only some S3 env vars are set", async () => {
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
    const { getStorage, LocalStorage } = await import("./lib/storage");
    const storage = getStorage();
    expect(storage).toBeInstanceOf(LocalStorage);
  });

  it("throws in production when S3 is not configured", async () => {
    const originalEnv = { ...process.env };
    process.env.NODE_ENV = "production";
    process.env.APP_ID = "test";
    process.env.APP_SECRET = "test";
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/testdb";
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
    vi.resetModules();
    try {
      await expect(import("./lib/storage")).rejects.toThrow(/Permanent storage is not configured/);
    } finally {
      Object.assign(process.env, originalEnv);
    }
  });
});

describe("guessContentType", () => {
  it("returns correct MIME types for known extensions", () => {
    expect(guessContentType("image.png")).toBe("image/png");
    expect(guessContentType("photo.jpg")).toBe("image/jpeg");
    expect(guessContentType("photo.jpeg")).toBe("image/jpeg");
    expect(guessContentType("animation.gif")).toBe("image/gif");
    expect(guessContentType("photo.webp")).toBe("image/webp");
    expect(guessContentType("graphic.svg")).toBe("image/svg+xml");
    expect(guessContentType("photo.avif")).toBe("image/avif");
    expect(guessContentType("video.mp4")).toBe("video/mp4");
    expect(guessContentType("video.webm")).toBe("video/webm");
    expect(guessContentType("video.mov")).toBe("video/quicktime");
  });

  it("returns octet-stream for unknown extensions", () => {
    expect(guessContentType("file.xyz")).toBe("application/octet-stream");
    expect(guessContentType("noextension")).toBe("application/octet-stream");
  });
});
