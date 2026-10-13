import { describe, expect, it } from "vitest";
import { appRouter } from "./router";
import type { TrpcContext } from "./context";
import { mediaAlbums, mediaItems, mediaAlbumLinks } from "@db/schema";
import type { Role } from "@contracts/constants";
import type { User } from "@db/schema";

const unauthCtx: TrpcContext = {
  req: new Request("http://localhost/api/trpc/media.albumList"),
  resHeaders: new Headers(),
};

function makeUser(role: Role): User {
  return {
    id: 999, unionId: "union-999", name: "Test Admin", email: null, avatar: null,
    bio: null, instagram: null, role, banned: false, provider: "local" as const,
    providerId: "test-999", username: "testadmin", passwordHash: "hash",
    emailVerified: false, createdAt: new Date(), updatedAt: new Date(),
    lastSignInAt: new Date(), xp: 0, usernameLower: "testadmin",
    featuredCardIds: null, hiddenCardIds: null,
  };
}

function adminCtx(): TrpcContext {
  return {
    req: new Request("http://localhost/api/trpc/media.albumCreate"),
    resHeaders: new Headers(),
    user: makeUser("admin"),
  };
}

describe("media album procedures - structure", () => {
  it("exposes the album procedures on the media router", () => {
    const m = appRouter.createCaller(unauthCtx).media;
    expect(typeof m.albumList).toBe("function");
    expect(typeof m.albumGet).toBe("function");
    expect(typeof m.albumListAll).toBe("function");
    expect(typeof m.albumCreate).toBe("function");
    expect(typeof m.albumUpdate).toBe("function");
    expect(typeof m.albumDelete).toBe("function");
    expect(typeof m.albumBulkUpload).toBe("function");
    expect(typeof m.albumReorderItems).toBe("function");
    expect(typeof m.albumDownloadPhotos).toBe("function");
  });

  it("media_albums / media_album_links tables exist in schema", () => {
    expect(mediaAlbums).toBeDefined();
    expect(mediaAlbumLinks).toBeDefined();
    expect(mediaItems).toBeDefined();
  });

  it("albumList public query runs and returns a paginated shape", async () => {
    const result = await appRouter.createCaller(unauthCtx).media.albumList({});
    expect(result).toHaveProperty("albums");
    expect(Array.isArray(result.albums)).toBe(true);
    expect(result).toHaveProperty("hasMore");
    expect(result).toHaveProperty("nextCursor");
  });
});

describe("media album admin workflow (live DB)", () => {
  const ctx = adminCtx();
  const caller = () => appRouter.createCaller(ctx).media;

  it("full CRUD: create album, bulk upload, get, update cover, bulk delete items, delete album", async () => {
    // 1. Create an album (draft so it's not public)
    const created = await caller().albumCreate({
      title: `Test Album ${Date.now()}`,
      status: "published",
    });
    expect(created.id).toBeGreaterThan(0);

    // 2. Bulk upload 3 items into the album
    const res = await caller().albumBulkUpload({
      albumId: created.id,
      items: [
        { title: "Photo 1", type: "photo", fileBase64: "iVBORw0KGgo=", fileName: "p1.png", fileContentType: "image/png", caption: "First", displayOrder: 0 },
        { title: "Photo 2", type: "photo", fileBase64: "iVBORw0KGgo=", fileName: "p2.png", fileContentType: "image/png", caption: "Second", displayOrder: 1 },
        { title: "Photo 3", type: "photo", fileBase64: "iVBORw0KGgo=", fileName: "p3.png", fileContentType: "image/png", caption: "Third", displayOrder: 2 },
      ],
    });
    expect(res.count).toBe(3);

    // 3. Get the album and confirm 3 items
    const album = await caller().albumGet({ id: created.id });
    expect(album).not.toBeNull();
    expect(album!.mediaCount).toBe(3);
    expect(album!.items.length).toBe(3);

    // 4. Set a cover
    const coverKey = album!.items[0].thumbnailKey || album!.items[0].fileKey;
    await caller().albumUpdate({ id: created.id, coverKey: coverKey ?? undefined });

    // 5. Bulk-delete 1 item
    await caller().albumBulkDeleteItems({ albumId: created.id, ids: [album!.items[0].id] });
    const afterDelete = await caller().albumGet({ id: created.id });
    expect(afterDelete!.mediaCount).toBe(2);

    // 6. listAll shows the album
    const all = await caller().albumListAll();
    expect(all.some((a) => a.id === created.id)).toBe(true);

    // 7. Delete the album
    await caller().albumDelete({ id: created.id });
    const deleted = await caller().albumGet({ id: created.id });
    expect(deleted).toBeNull();
  }, 30_000);
});
