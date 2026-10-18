export function getJwtSecret() {
  const value = process.env.JWT_SECRET ?? "";
  if (Buffer.byteLength(value, "utf8") < 32) throw new Error("JWT_SECRET must be at least 32 bytes");
  return value;
}

export function validateSecurityConfig() {
  getJwtSecret();
  if (process.env.NODE_ENV === "production") {
    if (!process.env.FRONTEND_URL?.startsWith("https://")) throw new Error("FRONTEND_URL must use HTTPS in production");
    if (!process.env.ENCRYPTION_KEY || !/^[a-fA-F0-9]{64}$/.test(process.env.ENCRYPTION_KEY)) throw new Error("ENCRYPTION_KEY must be a 32-byte hexadecimal key");
  }
}
