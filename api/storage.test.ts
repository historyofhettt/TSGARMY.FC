import { describe, expect, it, vi } from "vitest";
import path from "path";
import fs from "fs";
import { storage } from "./lib/storage";

describe("storage upload path resolution", () => {
  it("production mode: uploads persist to dist/public/uploads and are servable", async () => {
    process.env.NODE_ENV = "production";
    process.env.APP_ID = "test";
    process.env.APP_SECRET = "test";
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/testdb";
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
    process.env.S3_BUCKET = "test-bucket";
    vi.resetModules();

    const { UPLOAD_ROOT } = await import("./lib/storage");
    expect(UPLOAD_ROOT).toContain("dist");
    expect(UPLOAD_ROOT).toContain("uploads");
    expect(fs.existsSync(UPLOAD_ROOT)).toBe(true);
  });

  it("development mode: uploads persist to public/uploads and are servable", async () => {
    process.env.NODE_ENV = "test";
    process.env.APP_ID = "test";
    process.env.APP_SECRET = "test";
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/testdb";
    vi.resetModules();

    const { UPLOAD_ROOT } = await import("./lib/storage");
    expect(UPLOAD_ROOT).toContain("public");
    expect(UPLOAD_ROOT).toContain("uploads");
    expect(fs.existsSync(UPLOAD_ROOT)).toBe(true);
  });

  it("uploadFile returns a key whose URL maps to the correct filesystem path", async () => {
    const testContent = Buffer.from("fake-image-data");
    const result = await storage.uploadFile({
      fileContent: testContent,
      fileName: "test-upload.png",
      contentType: "image/png",
    });

    expect(result.key).toContain("tsg/");
    expect(result.key).toContain("test-upload.png");

    const expectedPath = path.resolve(process.cwd(), "public", "uploads", result.key);
    expect(fs.existsSync(expectedPath)).toBe(true);

    fs.unlinkSync(expectedPath);
  });
});
