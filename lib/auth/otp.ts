import crypto from "crypto";

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 999999));
}

export function hashOtpCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function isOtpValid(code: string, hash: string | null | undefined, expiresAt: Date | null | undefined) {
  if (!hash || !expiresAt || expiresAt.getTime() < Date.now()) return false;
  return hashOtpCode(code) === hash;
}
