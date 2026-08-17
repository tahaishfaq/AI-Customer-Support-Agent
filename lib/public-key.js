import { randomBytes } from "crypto";

export function createPublicKey() {
  return randomBytes(18).toString("base64url");
}
