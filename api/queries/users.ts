import { and, eq, ne } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser } from "@db/schema";
import { getDb } from "./connection";
import { env } from "../lib/env";

export async function findUserByUnionId(unionId: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.unionId, unionId))
    .limit(1);
  return rows.at(0);
}

export async function findUserByProvider(
  provider: "google" | "discord",
  providerId: string,
) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.provider, provider),
        eq(schema.users.providerId, providerId),
      ),
    )
    .limit(1);
  return rows.at(0);
}

export async function findUserByUsername(username: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.usernameLower, username.toLowerCase()))
    .limit(1);
  return rows.at(0);
}

export async function findUserByEmail(email: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return rows.at(0);
}

export async function findLocalUserByIdentifier(identifier: string) {
  const byUsername = await findUserByUsername(identifier);
  if (byUsername && byUsername.provider === "local") {
    return byUsername;
  }
  const byEmail = await findUserByEmail(identifier);
  if (byEmail && byEmail.provider === "local") {
    return byEmail;
  }
  return null;
}

export async function usernameExists(username: string, excludeUserId?: number) {
  const db = getDb();
  const lower = username.toLowerCase();
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      excludeUserId !== undefined
        ? and(eq(schema.users.usernameLower, lower), ne(schema.users.id, excludeUserId))
        : eq(schema.users.usernameLower, lower),
    )
    .limit(1);
  return rows.length > 0;
}

export async function updatePassword(userId: number, passwordHash: string) {
  await getDb()
    .update(schema.users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId));
}

export async function upsertUser(data: InsertUser) {
  const values = { ...data };
  const updateSet: Partial<InsertUser> = {
    lastSignInAt: new Date(),
    ...data,
  };

  if (values.provider === "google" && values.email) {
    if (env.ownerGoogleEmail && values.email === env.ownerGoogleEmail) {
      values.role = "admin";
      updateSet.role = "admin";
    } else if (values.role === undefined) {
      values.role = "fan";
    }
  } else if (values.provider === "discord" && values.providerId) {
    if (
      env.ownerDiscordId &&
      values.providerId === env.ownerDiscordId
    ) {
      values.role = "admin";
      updateSet.role = "admin";
    } else if (values.role === undefined) {
      values.role = "fan";
    }
  } else if (values.role === undefined) {
    values.role = "fan";
  }

  if (data.avatar && (data.provider === "google" || data.provider === "discord") && data.providerId) {
    const existing = await findUserByProvider(data.provider, data.providerId);
    if (existing?.avatar) {
      delete (updateSet as Record<string, unknown>).avatar;
    }
  }

   // For OAuth users, enforce unique username (case-insensitive).
  // If a username was provided, check for conflicts.
  // No username is provided from the initial OAuth flow — the user will be
  // redirected to the username selection page.
  if (values.username && (values.provider === "google" || values.provider === "discord")) {
    const existingByProvider = values.providerId ? await findUserByProvider(values.provider, values.providerId) : null;
    if (await usernameExists(values.username, existingByProvider?.id)) {
      throw new Error("Username already exists");
    }
  }

  try {
    await getDb()
      .insert(schema.users)
      .values(values)
      .onDuplicateKeyUpdate({ set: updateSet });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY" || /duplicate/i.test(err?.message ?? "")) {
      throw new Error("Username already exists");
    }
    throw err;
  }
}
