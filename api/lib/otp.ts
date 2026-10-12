import { randomInt } from "crypto";
import bcrypt from "bcrypt";

const OTP_LENGTH = 6;
const OTP_SALT_ROUNDS = 12;

export function generateOtp(): string {
  // Cryptographically secure 6-digit OTP (000000 - 999999)
  const n = randomInt(0, 1_000_000);
  return n.toString().padStart(OTP_LENGTH, "0");
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, OTP_SALT_ROUNDS);
}

export async function verifyOtp(
  otp: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}