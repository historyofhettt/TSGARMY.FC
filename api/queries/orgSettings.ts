import { getDb } from "./connection";
import { orgSettings } from "@db/schema";

export type OrgSettings = typeof orgSettings.$inferSelect;

export async function getOrgSettings(): Promise<OrgSettings> {
  const db = getDb();
  let [row] = await db.select().from(orgSettings).limit(1);
  if (!row) {
    await db.insert(orgSettings).values({});
    [row] = await db.select().from(orgSettings).limit(1);
  }
  return row;
}

export function getXpEnabledRoles(settings: OrgSettings | undefined): string[] {
  if (!settings?.xpEnabledRoles) {
    return ["fan", "player", "moderator", "admin"];
  }
  try {
    const parsed = JSON.parse(settings.xpEnabledRoles);
    if (Array.isArray(parsed)) {
      return parsed.filter((r): r is string => typeof r === "string");
    }
  } catch {
    // fall through
  }
  return ["fan", "player", "moderator", "admin"];
}

export function setXpEnabledRoles(settings: OrgSettings, roles: string[]) {
  return {
    ...settings,
    xpEnabledRoles: JSON.stringify(roles),
  };
}

export function getLiveSectionEnabledRoles(settings: OrgSettings | undefined): string[] {
  if (!settings?.liveSectionEnabledRoles) {
    return ["player"];
  }
  try {
    const parsed = JSON.parse(settings.liveSectionEnabledRoles);
    if (Array.isArray(parsed)) {
      return parsed.filter((r): r is string => typeof r === "string");
    }
  } catch {
    // fall through
  }
  return ["player"];
}

export function setLiveSectionEnabledRoles(settings: OrgSettings, roles: string[]) {
  return {
    ...settings,
    liveSectionEnabledRoles: JSON.stringify(roles),
  };
}
