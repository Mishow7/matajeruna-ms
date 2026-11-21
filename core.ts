import { cookies } from "next/headers";
import crypto from "crypto";
import { db, users, merchants } from "@/db";
import { eq } from "drizzle-orm";

const SESSION_COOKIE = "matajeruna_session";
const SECRET = process.env.SESSION_SECRET || "matajeruna-yemen-saas-2026-secret-key";

export const RESERVED_SLUGS = new Set([
  "api",
  "login",
  "register",
  "merchant",
  "admin",
  "customer",
  "images",
  "favicon.ico",
  "_next",
  "stores",
  "dashboard",
  "about",
  "pricing",
]);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, originalHash] = stored.split(":");
  if (!salt || !originalHash) return false;
  const hashBuffer = crypto.scryptSync(password, salt, 64);
  const originalBuffer = Buffer.from(originalHash, "hex");
  if (hashBuffer.length !== originalBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, originalBuffer);
}

export interface SessionPayload {
  userId: number;
  role: "super_admin" | "merchant" | "customer";
  exp: number;
}

export function signSession(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expectedSig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: number, role: "super_admin" | "merchant" | "customer") {
  const token = signSession({
    userId,
    role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14, // 14 days
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  if (!user) return null;

  let merchant = null;
  if (user.role === "merchant") {
    const [m] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.userId, user.id))
      .limit(1);
    if (m) {
      if (m.status === "active" && m.subscriptionEndsAt && new Date(m.subscriptionEndsAt) < new Date()) {
        const [updated] = await db
          .update(merchants)
          .set({ status: "expired" })
          .where(eq(merchants.id, m.id))
          .returning();
        merchant = updated ?? m;
      } else {
        merchant = m;
      }
    }
  }

  return { user, merchant };
}

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 3 || slug.length > 40) return false;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return true;
}

export function calculateFinalPrice(
  originalPrice: number,
  discountType: "none" | "percentage" | "fixed",
  discountValue: number
): number {
  const price = Math.max(0, Math.round(originalPrice));
  const val = Math.max(0, Number(discountValue) || 0);
  if (discountType === "percentage") {
    const pct = Math.min(100, val);
    return Math.max(0, Math.round(price - (price * pct) / 100));
  }
  if (discountType === "fixed") {
    return Math.max(0, Math.round(price - val));
  }
  return price;
}

export function formatYer(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-US")} ريال`;
}

export function isMerchantStoreLive(merchant: {
  status: string;
  subscriptionEndsAt: Date | string | null;
}): boolean {
  if (merchant.status !== "active") return false;
  if (merchant.subscriptionEndsAt && new Date(merchant.subscriptionEndsAt) < new Date()) {
    return false;
  }
  return true;
}
