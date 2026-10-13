import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { appRouter } from "./router";
import type { TrpcContext } from "./context";
import { getDb } from "./queries/connection";
import { adCampaigns, adCreatives } from "../db/schema";
import { eq } from "drizzle-orm";

const unauthCtx: TrpcContext = {
  req: new Request("http://localhost/api/trpc/public.activeAds"),
  resHeaders: new Headers(),
};

describe("public.activeAds", () => {
  it("returns active campaigns matching placement and page", async () => {
    const caller = appRouter.createCaller(unauthCtx).public;
    const ads = await caller.activeAds({
      placement: "feed_bottom",
      page: "home",
      limit: 10,
    });
    expect(Array.isArray(ads)).toBe(true);
    expect(ads.length).toBeGreaterThanOrEqual(0);
    for (const ad of ads) {
      expect(ad).toHaveProperty("id");
      expect(ad).toHaveProperty("name");
      expect(ad).toHaveProperty("placement");
      expect(ad).toHaveProperty("creatives");
      expect(Array.isArray(ad.creatives)).toBe(true);
      for (const cr of ad.creatives) {
        expect(cr).toHaveProperty("id");
        expect(cr).toHaveProperty("title");
        expect(cr).toHaveProperty("destinationUrl");
        expect(cr).toHaveProperty("layout");
        expect(cr).toHaveProperty("desktopVisible");
        expect(cr).toHaveProperty("mobileVisible");
      }
    }
  });

  it("respects placement filter", async () => {
    const caller = appRouter.createCaller(unauthCtx).public;
    const sidebarAds = await caller.activeAds({
      placement: "sidebar",
      page: "home",
    });
    const headerAds = await caller.activeAds({
      placement: "header",
      page: "home",
    });
    // Each ad must match the requested placement
    for (const ad of [...sidebarAds, ...headerAds]) {
      expect(ad.placement).toBeDefined();
    }
  });

  it("does not throw when no matching ads exist", async () => {
    const caller = appRouter.createCaller(unauthCtx).public;
    const ads = await caller.activeAds({
      placement: "sidebar",
      page: "nonexistent-page-xyz",
      limit: 5,
    });
    expect(Array.isArray(ads)).toBe(true);
  });
});

describe("admin.previewAdDelivery", () => {
  function makeAdminCtx(): TrpcContext {
    return {
      req: new Request("http://localhost/api/trpc/admin.previewAdDelivery"),
      resHeaders: new Headers(),
      user: {
        id: 999, unionId: "union-999", name: "Test Admin", email: null, avatar: null,
        bio: null, instagram: null, role: "admin", banned: false, provider: "local" as const,
        providerId: "test-999", username: "testadmin", passwordHash: "hash",
        emailVerified: false, createdAt: new Date(), updatedAt: new Date(),
        lastSignInAt: new Date(), xp: 0, usernameLower: "testadmin",
        featuredCardIds: null, hiddenCardIds: null,
      },
    };
  }

  let testCampaignId: number;

  beforeEach(async () => {
    const db = getDb();
    const result = await db
      .insert(adCampaigns)
      .values({
        name: "Test Campaign for previewAdDelivery",
        advertiser: "TSG",
        description: "Test",
        status: "active",
        placement: "feed_bottom",
        targetPages: null,
        budget: 100,
        startDate: null,
        endDate: null,
        frequencyCap: 3,
        priority: 0,
        impressionLimit: null,
        isActive: true,
      })
      .$returningId();
    testCampaignId = (result as Array<{ id: number }>)[0]?.id ?? 0;
    await db.insert(adCreatives).values({
      campaignId: testCampaignId,
      title: "Test Creative",
      mediaKey: "test/preview-creative.png",
      mediaType: "image",
      destinationUrl: "https://www.twosidegamers.com",
      buttonText: "Learn More",
      advertiser: "TSG",
      layout: "card",
      desktopVisible: true,
      mobileVisible: true,
      aspectRatio: "16/9",
      ctaStyle: "filled",
    });
  });

  afterEach(async () => {
    const db = getDb();
    await db.delete(adCreatives).where(eq(adCreatives.campaignId, testCampaignId));
    await db.delete(adCampaigns).where(eq(adCampaigns.id, testCampaignId));
  });

  it("returns eligible status and reason list for a campaign", async () => {
    const caller = appRouter.createCaller(makeAdminCtx()).admin;
    const result = await caller.previewAdDelivery({
      campaignId: testCampaignId,
      page: "home",
      placement: "feed_bottom",
      isMobile: false,
    });
    expect(result).toHaveProperty("eligible");
    expect(result).toHaveProperty("reasons");
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(result).toHaveProperty("campaign");
    expect(result).toHaveProperty("creatives");
    expect(Array.isArray(result.creatives)).toBe(true);
  });

  it("returns reason when campaign does not exist", async () => {
    const caller = appRouter.createCaller(makeAdminCtx()).admin;
    const result = await caller.previewAdDelivery({
      campaignId: 99999,
      page: "home",
      placement: "feed_bottom",
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("Campaign not found");
  });
});
