import * as jose from "jose";
import { env } from "./lib/env";
import type { SessionPayload } from "./types";

const JWT_ALG = "HS256";

export async function signSessionToken(
  payload: SessionPayload,
): Promise<string> {
  const secret = new TextEncoder().encode(env.appSecret);
  return new jose.SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("1 year")
    .sign(secret);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }
  try {
    const secret = new TextEncoder().encode(env.appSecret);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: [JWT_ALG],
    });
    const kind = (payload as Record<string, unknown>)?.kind as
      | SessionPayload["kind"]
      | undefined;
    if (!kind) {
      return null;
    }
    if (
      kind === "google" ||
      kind === "discord" ||
      kind === "local"
    ) {
      const userId = (payload as Record<string, unknown>)?.userId as
        | number
        | undefined;
      if (!userId) {
        return null;
      }
      return { kind, userId };
    }
    return null;
  } catch {
    return null;
  }
}