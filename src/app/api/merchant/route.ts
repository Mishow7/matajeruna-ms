import { NextRequest, NextResponse } from "next/server";
import {
  db,
  merchants,
  subscriptionPlans,
  products,
  orders,
  orderItems,
  platformPaymentMethods,
  merchantPaymentMethods,
  subscriptionRequests,
  platformSettings,
} from "@/db";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { getCurrentSession, isValidSlug, normalizeSlug } from "@/lib/core";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const session = await getCurrentSession();
  if (!session || session.user.role !== "merchant" || !session.merchant) {
    return NextResponse.json({ error: "غير مصرح بالوصول" }, { status: 401 });
  }

  const merchant = session.merchant;

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, merchant.planId))
    .limit(1);

  const allPlans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(asc(subscriptionPlans.priceYer));

  const merchantProducts = await db
    .select()
    .from(products)
    .where(eq(products.merchantId, merchant.id))
    .orderBy(desc(products.createdAt));

  const merchantOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.merchantId, merchant.id))
    .orderBy(desc(orders.createdAt));

  const orderIds = merchantOrders.map((o) => o.id);
  const allOrderItems =
    orderIds.length > 0
      ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
      : [];

  const ordersWithItems = merchantOrders.map((o) => ({
    ...o,
    items: allOrderItems.filter((i) => i.orderId === o.id),
  }));

  const activePlatformMethods = await db
    .select()
    .from(platformPaymentMethods)
    .where(eq(platformPaymentMethods.isActive, true))
    .orderBy(asc(platformPaymentMethods.id));

  const savedMerchantMethods = await db
    .select()
    .from(merchantPaymentMethods)
    .where(eq(merchantPaymentMethods.merchantId, merchant.id));

  const savedByMethodId = new Map(savedMerchantMethods.map((m) => [m.platformMethodId, m]));

  const paymentMethods = activePlatformMethods.map((pm) => {
    const saved = savedByMethodId.get(pm.id);
    return {
      platformMethodId: pm.id,
      code: pm.code,
      nameAr: pm.nameAr,
      nameEn: pm.nameEn,
      type: pm.type,
      enabled: saved?.enabled ?? false,
      accountHolderName: saved?.accountHolderName ?? "",
      accountNumber: saved?.accountNumber ?? "",
      bankName: saved?.bankName ?? "",
    };
  });

  const subRequests = await db
    .select({
      id: subscriptionRequests.id,
      planId: subscriptionRequests.planId,
      planNameAr: subscriptionPlans.nameAr,
      amountYer: subscriptionRequests.amountYer,
      paymentMethodName: subscriptionRequests.paymentMethodName,
      receiptImageUrl: subscriptionRequests.receiptImageUrl,
      transferNote: subscriptionRequests.transferNote,
      status: subscriptionRequests.status,
      adminNote: subscriptionRequests.adminNote,
      reviewedAt: subscriptionRequests.reviewedAt,
      createdAt: subscriptionRequests.createdAt,
    })
    .from(subscriptionRequests)
    .innerJoin(subscriptionPlans, eq(subscriptionRequests.planId, subscriptionPlans.id))
    .where(eq(subscriptionRequests.merchantId, merchant.id))
    .orderBy(desc(subscriptionRequests.createdAt));

  const [walletSetting] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, "subscription_wallets"))
    .limit(1);

  return NextResponse.json({
    user: session.user,
    merchant,
    plan,
    allPlans,
    products: merchantProducts,
    orders: ordersWithItems,
    paymentMethods,
    subscriptionRequests: subRequests,
    subscriptionWallets: walletSetting?.value ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const session = await getCurrentSession();
  if (!session || session.user.role !== "merchant" || !session.merchant) {
    return NextResponse.json({ error: "غير مصرح بالوصول" }, { status: 401 });
  }

  const merchant = session.merchant;
  const body = await req.json();

  // 1. Update payment methods
  if (body.type === "payment_methods") {
    const methods = Array.isArray(body.methods) ? body.methods : [];
    for (const item of methods) {
      const platformMethodId = Number(item.platformMethodId);
      const enabled = Boolean(item.enabled);
      const accountHolderName = item.accountHolderName ? String(item.accountHolderName).trim() : null;
      const accountNumber = item.accountNumber ? String(item.accountNumber).trim() : null;
      const bankName = item.bankName ? String(item.bankName).trim() : null;

      const [pm] = await db
        .select()
        .from(platformPaymentMethods)
        .where(eq(platformPaymentMethods.id, platformMethodId))
        .limit(1);
      if (!pm) continue;

      if (enabled && pm.type !== "cod" && (!accountHolderName || !accountNumber)) {
        return NextResponse.json(
          { error: `يرجى إدخال اسم صاحب الحساب ورقم المحفظة/الحساب لطريقة "${pm.nameAr}"` },
          { status: 400 }
        );
      }

      const [existing] = await db
        .select()
        .from(merchantPaymentMethods)
        .where(
          and(
            eq(merchantPaymentMethods.merchantId, merchant.id),
            eq(merchantPaymentMethods.platformMethodId, platformMethodId)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(merchantPaymentMethods)
          .set({
            enabled,
            accountHolderName,
            accountNumber,
            bankName,
            updatedAt: new Date(),
          })
          .where(eq(merchantPaymentMethods.id, existing.id));
      } else {
        await db.insert(merchantPaymentMethods).values({
          merchantId: merchant.id,
          platformMethodId,
          enabled,
          accountHolderName,
          accountNumber,
          bankName,
        });
      }
    }
    return NextResponse.json({ ok: true });
  }

  // 2. Update order status
  if (body.type === "order_status") {
    const orderId = Number(body.orderId);
    const status = String(body.status);
    const allowed = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: "حالة طلب غير صالحة" }, { status: 400 });
    }
    const [updated] = await db
      .update(orders)
      .set({ status: status as "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" })
      .where(and(eq(orders.id, orderId), eq(orders.merchantId, merchant.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ order: updated });
  }

  // 3. Update store settings & slug
  const storeName = String(body.storeName || merchant.storeName).trim();
  const rawSlug = body.slug !== undefined ? String(body.slug) : merchant.slug;
  const slug = normalizeSlug(rawSlug);
  const primaryColor = String(body.primaryColor || merchant.primaryColor).trim();
  const logoUrl = body.logoUrl !== undefined ? (body.logoUrl ? String(body.logoUrl).trim() : null) : merchant.logoUrl;
  const description =
    body.description !== undefined ? String(body.description).trim() : merchant.description;
  const city = body.city !== undefined ? String(body.city).trim() : merchant.city;
  const phone = body.phone !== undefined ? String(body.phone).trim() : merchant.phone;

  if (!storeName) {
    return NextResponse.json({ error: "اسم المتجر مطلوب" }, { status: 400 });
  }
  if (!isValidSlug(slug)) {
    return NextResponse.json(
      { error: "رابط المتجر يجب أن يكون بالإنجليزية (3-40 حرفاً وأرقام أو شرطة فقط وغير محجوز)" },
      { status: 400 }
    );
  }

  const [conflict] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(and(eq(merchants.slug, slug), ne(merchants.id, merchant.id)))
    .limit(1);

  if (conflict) {
    return NextResponse.json({ error: "هذا الرابط مستخدم بالفعل من تاجر آخر" }, { status: 409 });
  }

  const [updated] = await db
    .update(merchants)
    .set({
      storeName,
      slug,
      primaryColor,
      logoUrl,
      description,
      city,
      phone,
    })
    .where(eq(merchants.id, merchant.id))
    .returning();

  return NextResponse.json({ merchant: updated });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const session = await getCurrentSession();
  if (!session || session.user.role !== "merchant" || !session.merchant) {
    return NextResponse.json({ error: "غير مصرح بالوصول" }, { status: 401 });
  }

  const body = await req.json();
  const planId = Number(body.planId);
  const paymentMethodName = String(body.paymentMethodName || "").trim();
  const receiptImageUrl = String(body.receiptImageUrl || "").trim();
  const transferNote = body.transferNote ? String(body.transferNote).trim() : null;

  if (!planId || !paymentMethodName || !receiptImageUrl) {
    return NextResponse.json(
      { error: "يرجى اختيار الباقة وطريقة التحويل وإرفاق صورة الإيصال" },
      { status: 400 }
    );
  }

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.id, planId), eq(subscriptionPlans.isActive, true)))
    .limit(1);

  if (!plan) {
    return NextResponse.json({ error: "الباقة المختارة غير متوفرة" }, { status: 400 });
  }

  const [created] = await db
    .insert(subscriptionRequests)
    .values({
      merchantId: session.merchant.id,
      planId: plan.id,
      amountYer: plan.priceYer,
      paymentMethodName,
      receiptImageUrl,
      transferNote,
      status: "pending",
    })
    .returning();

  return NextResponse.json({ request: created }, { status: 201 });
}
