import { NextRequest, NextResponse } from "next/server";
import { db, users, merchants, subscriptionPlans, subscriptionRequests } from "@/db";
import { eq } from "drizzle-orm";
import {
  clearSessionCookie,
  getCurrentSession,
  hashPassword,
  isValidSlug,
  normalizeSlug,
  setSessionCookie,
  verifyPassword,
} from "@/lib/core";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const session = await getCurrentSession();
  return NextResponse.json(session ?? { user: null, merchant: null });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "logout") {
      await clearSessionCookie();
      return NextResponse.json({ ok: true });
    }

    if (action === "login") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (!email || !password) {
        return NextResponse.json({ error: "يرجى إدخال البريد الإلكتروني وكلمة المرور" }, { status: 400 });
      }

      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
      }

      await setSessionCookie(user.id, user.role);

      let merchant = null;
      if (user.role === "merchant") {
        const [m] = await db.select().from(merchants).where(eq(merchants.userId, user.id)).limit(1);
        merchant = m ?? null;
      }

      return NextResponse.json({
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
        merchant,
      });
    }

    if (action === "register") {
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const phone = String(body.phone || "").trim();
      const password = String(body.password || "");
      const role = body.role === "merchant" ? "merchant" : "customer";

      if (!name || !email || password.length < 6) {
        return NextResponse.json(
          { error: "الاسم والبريد الإلكتروني وكلمة المرور (6 أحرف على الأقل) مطلوبة" },
          { status: 400 }
        );
      }

      const [existingEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existingEmail) {
        return NextResponse.json({ error: "البريد الإلكتروني مسجل مسبقاً" }, { status: 409 });
      }

      if (role === "customer") {
        const [newUser] = await db
          .insert(users)
          .values({
            name,
            email,
            phone: phone || null,
            passwordHash: hashPassword(password),
            role: "customer",
          })
          .returning({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role });

        await setSessionCookie(newUser.id, "customer");
        return NextResponse.json({ user: newUser, merchant: null }, { status: 201 });
      }

      // Merchant registration
      const storeName = String(body.storeName || "").trim();
      const rawSlug = String(body.slug || "");
      const slug = normalizeSlug(rawSlug);
      const planId = Number(body.planId);
      const city = String(body.city || "").trim();

      if (!storeName) {
        return NextResponse.json({ error: "اسم المتجر مطلوب" }, { status: 400 });
      }
      if (!isValidSlug(slug)) {
        return NextResponse.json(
          { error: "رابط المتجر يجب أن يكون بالإنجليزية (3-40 حرفاً وأرقام أو شرطة فقط)" },
          { status: 400 }
        );
      }

      const [existingSlug] = await db
        .select({ id: merchants.id })
        .from(merchants)
        .where(eq(merchants.slug, slug))
        .limit(1);
      if (existingSlug) {
        return NextResponse.json({ error: "رابط المتجر مستخدم بالفعل من تاجر آخر" }, { status: 409 });
      }

      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
        .limit(1);

      if (!plan || !plan.isActive) {
        return NextResponse.json({ error: "يرجى اختيار باقة اشتراك صالحة" }, { status: 400 });
      }

      const result = await db.transaction(async (tx) => {
        const [newUser] = await tx
          .insert(users)
          .values({
            name,
            email,
            phone: phone || null,
            passwordHash: hashPassword(password),
            role: "merchant",
          })
          .returning({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role });

        const [newMerchant] = await tx
          .insert(merchants)
          .values({
            userId: newUser.id,
            planId: plan.id,
            storeName,
            slug,
            city: city || null,
            phone: phone || null,
            primaryColor: "#0f766e",
            status: "pending",
          })
          .returning();

        // Optional receipt uploaded right during registration
        if (body.receiptImageUrl && body.paymentMethodName) {
          await tx.insert(subscriptionRequests).values({
            merchantId: newMerchant.id,
            planId: plan.id,
            amountYer: plan.priceYer,
            paymentMethodName: String(body.paymentMethodName),
            receiptImageUrl: String(body.receiptImageUrl),
            transferNote: body.transferNote ? String(body.transferNote) : null,
            status: "pending",
          });
        }

        return { user: newUser, merchant: newMerchant };
      });

      await setSessionCookie(result.user.id, "merchant");
      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Auth API error:", err);
    const code = (err as { code?: string } | null)?.code ?? "";
    // Postgres unique violation (e.g. email registered by a concurrent request)
    if (code === "23505") {
      return NextResponse.json({ error: "البريد الإلكتروني مسجل مسبقاً" }, { status: 409 });
    }
    // Connection / authentication / missing database problems
    const dbErrorCodes = ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN", "28P01", "3D000", "08001", "08006"];
    if (dbErrorCodes.includes(code) || String((err as Error)?.message).includes("DATABASE_URL")) {
      return NextResponse.json(
        { error: "تعذر الاتصال بقاعدة البيانات. تحقق من إعداد DATABASE_URL في إعدادات الاستضافة." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "حدث خطأ في الخادم، حاول مرة أخرى" }, { status: 500 });
  }
}
