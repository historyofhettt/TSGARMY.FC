import { describe, expect, it } from "vitest";

describe("footer logo schema (static validation)", () => {
  it("orgSettings table includes footerLogoKey column", async () => {
    const { orgSettings } = await import("../db/schema");
    expect("footerLogoKey" in orgSettings).toBe(true);
    expect(typeof orgSettings.footerLogoKey).toBe("object");
    expect(orgSettings.footerLogoKey).not.toBeNull();
  });
});
