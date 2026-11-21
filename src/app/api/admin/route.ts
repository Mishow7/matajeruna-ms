import { NextRequest, NextResponse } from "next/server";
import {
  db,
  users,
  merchants,
  subscriptionPlans,
  platformPaymentMethods,
  merchantPaymentMethods,
  subscriptionRequests,
  products,
  orders,
  platformSettings,
} from "@/db";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import { getCurrentSession, hashPassword } from "@/lib/core";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  await ensureSeeded();
  const session = await getCurrentSession();
  if (!session || session.user.role !== "super_admin") {
    return null;
  }
  return session;
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح بالوصول - صلاحية سوبر أدمن مطلوبة" }, { status: 403 });
  }

  // Auto-expire merchants whose subscription period ended
  await db
    .update(merchants)
    .set({ status: "expired" })
    .where(and(eq(merchants.status, "active"), lt(merchants.subscriptionEndsAt, new Date())));

  const merchantIdParam = req.nextUrl.searchParams.get("merchantId");

  // Deep single merchant details view
  if (merchantIdParam) {
    const mId = Number(merchantIdParam);
    const [m] = await db
      .select({
        id: merchants.id,
        userId: merchants.userId,
        planId: merchants.planId,
        storeName: merchants.storeName,
        slug: merchants.slug,
        logoUrl: merchants.logoUrl,
        primaryColor: merchants.primaryColor,
        description: merchants.description,
        city: merchants.city,
        phone: merchants.phone,
        status: merchants.status,
        subscriptionEndsAt: merchants.subscriptionEndsAt,
        createdAt: merchants.createdAt,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerPhone: users.phone,
        planNameAr: subscriptionPlans.nameAr,
      })
      .from(merchants)
      .innerJoin(users, eq(merchants.userId, users.id))
      .innerJoin(subscriptionPlans, eq(merchants.planId, subscriptionPlans.id))
      .where(eq(merchants.id, mId))
      .limit(1);

    if (!m) {
      return NextResponse.json({ error: "التاجر غير موجود" }, { status: 404 });
    }

    const mProducts = await db
      .select()
      .from(products)
      .where(eq(products.merchantId, mId))
      .orderBy(desc(products.createdAt));

    const mOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.merchantId, mId))
      .orderBy(desc(orders.createdAt));

    const mPayments = await db
      .select({
        id: platformPaymentMethods.id,
        nameAr: platformPaymentMethods.nameAr,
        enabled: merchantPaymentMethods.enabled,
        accountHolderName: merchantPaymentMethods.accountHolderName,
        accountNumber: merchantPaymentMethods.accountNumber,
        bankName: merchantPaymentMethods.bankName,
      })
      .from(merchantPaymentMethods)
      .innerJoin(
        platformPaymentMethods,
        eq(merchantPaymentMethods.platformMethodId, platformPaymentMethods.id)
      )
      .where(eq(merchantPaymentMethods.merchantId, mId));

    return NextResponse.json({
      merchant: m,
      products: mProducts,
      orders: mOrders,
      paymentMethods: mPayments,
    });
  }

  const allMerchants = await db
    .select({
      id: merchants.id,
      userId: merchants.userId,
      planId: merchants.planId,
      storeName: merchants.storeName,
      slug: merchants.slug,
      logoUrl: merchants.logoUrl,
      primaryColor: merchants.primaryColor,
      city: merchants.city,
      phone: merchants.phone,
      status: merchants.status,
      subscriptionEndsAt: merchants.subscriptionEndsAt,
      createdAt: merchants.createdAt,
      ownerName: users.name,
      ownerEmail: users.email,
      ownerPhone: users.phone,
      planNameAr: subscriptionPlans.nameAr,
    })
    .from(merchants)
    .innerJoin(users, eq(merchants.userId, users.id))
    .innerJoin(subscriptionPlans, eq(merchants.planId, subscriptionPlans.id))
    .orderBy(desc(merchants.createdAt));

  const allProducts = await db
    .select({ id: products.id, merchantId: products.merchantId })
    .from(products);

  const allOrders = await db
    .select({ id: orders.id, merchantId: orders.merchantId, totalAmount: orders.totalAmount })
    .from(orders);

  const enrichedMerchants = allMerchants.map((m) => {
    const mProds = allProducts.filter((p) => p.merchantId === m.id);
    const mOrds = allOrders.filter((o) => o.merchantId === m.id);
    const salesTotal = mOrds.reduce((acc, o) => acc + o.totalAmount, 0);
    return {
      ...m,
      productsCount: mProds.length,
      ordersCount: mOrds.length,
      salesTotal,
    };
  });

  const allRequests = await db
    .select({
      id: subscriptionRequests.id,
      merchantId: subscriptionRequests.merchantId,
      storeName: merchants.storeName,
      storeSlug: merchants.slug,
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
    .innerJoin(merchants, eq(subscriptionRequests.merchantId, merchants.id))
    .innerJoin(subscriptionPlans, eq(subscriptionRequests.planId, subscriptionPlans.id))
    .orderBy(desc(subscriptionRequests.createdAt));

  const plans = await db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.priceYer));
  const paymentMethods = await db
    .select()
    .from(platformPaymentMethods)
    .orderBy(asc(platformPaymentMethods.id));

  const [walletSetting] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, "subscription_wallets"))
    .limit(1);

  const now = Date.now();
  const sevenDaysLater = now + 7 * 24 * 60 * 60 * 1000;

  const expiringSoon = enrichedMerchants.filter(
    (m) =>
      m.status === "active" &&
      m.subscriptionEndsAt &&
      new Date(m.subscriptionEndsAt).getTime() <= sevenDaysLater &&
      new Date(m.subscriptionEndsAt).getTime() > now
  );

  const totalSubscriptionRevenue = allRequests
    .filter((r) => r.status === "approved")
    .reduce((acc, r) => acc + r.amountYer, 0);

  const topMerchants = [...enrichedMerchants]
    .sort((a, b) => b.ordersCount * 3 + b.productsCount - (a.ordersCount * 3 + a.productsCount))
    .slice(0, 5);

  const stats = {
    totalMerchants: enrichedMerchants.length,
    activeMerchants: enrichedMerchants.filter((m) => m.status === "active").length,
    suspendedMerchants: enrichedMerchants.filter((m) => m.status === "suspended").length,
    expiredMerchants: enrichedMerchants.filter((m) => m.status === "expired").length,
    pendingMerchants: enrichedMerchants.filter((m) => m.status === "pending").length,
    pendingRequests: allRequests.filter((r) => r.status === "pending").length,
    totalSubscriptionRevenue,
    expiringSoon,
    topMerchants,
  };

  return NextResponse.json({
    stats,
    merchants: enrichedMerchants,
    subscriptionRequests: allRequests,
    plans,
    paymentMethods,
    subscriptionWallets: walletSetting?.value ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح بالوصول" }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  // 1. Approve or Reject Subscription Request
  if (action === "review_subscription") {
    const requestId = Number(body.requestId);
    const decision = body.decision === "approved" ? "approved" : "rejected";
    const adminNote = body.adminNote ? String(body.adminNote).trim() : null;

    const [subReq] = await db
      .select()
      .from(subscriptionRequests)
      .where(eq(subscriptionRequests.id, requestId))
      .limit(1);

    if (!subReq) {
      return NextResponse.json({ error: "طلب الاشتراك غير موجود" }, { status: 404 });
    }
    if (subReq.status !== "pending") {
      return NextResponse.json({ error: "تمت مراجعة هذا الطلب مسبقاً" }, { status: 400 });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(subscriptionRequests)
        .set({ status: decision, adminNote, reviewedAt: new Date() })
        .where(eq(subscriptionRequests.id, requestId));

      if (decision === "approved") {
        const [merchant] = await tx
          .select()
          .from(merchants)
          .where(eq(merchants.id, subReq.merchantId))
          .limit(1);

        if (merchant) {
          const baseTime =
            merchant.subscriptionEndsAt && new Date(merchant.subscriptionEndsAt).getTime() > Date.now()
              ? new Date(merchant.subscriptionEndsAt).getTime()
              : Date.now();
          const newEnd = new Date(baseTime + 30 * 24 * 60 * 60 * 1000);

          await tx
            .update(merchants)
            .set({
              planId: subReq.planId,
              status: "active",
              subscriptionEndsAt: newEnd,
            })
            .where(eq(merchants.id, merchant.id));
        }
      }
    });

    return NextResponse.json({ ok: true });
  }

  // 2. Plan CRUD
  if (action === "save_plan") {
    const id = body.id ? Number(body.id) : null;
    const data = {
      nameAr: String(body.nameAr || "").trim(),
      nameEn: String(body.nameEn || "").trim(),
      priceYer: Math.max(0, Math.round(Number(body.priceYer) || 0)),
      maxProducts: Math.max(1, Math.round(Number(body.maxProducts) || 10)),
      maxImagesPerProduct: Math.max(1, Math.round(Number(body.maxImagesPerProduct) || 2)),
      reportsEnabled: Boolean(body.reportsEnabled),
      supportLevel: String(body.supportLevel || "دعم فني عادي").trim(),
      descriptionAr: body.descriptionAr ? String(body.descriptionAr).trim() : null,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    };

    if (!data.nameAr || !data.nameEn) {
      return NextResponse.json({ error: "اسم الباقة بالعربية والإنجليزية مطلوب" }, { status: 400 });
    }

    if (id) {
      const [updated] = await db
        .update(subscriptionPlans)
        .set(data)
        .where(eq(subscriptionPlans.id, id))
        .returning();
      return NextResponse.json({ plan: updated });
    } else {
      const [created] = await db.insert(subscriptionPlans).values(data).returning();
      return NextResponse.json({ plan: created }, { status: 201 });
    }
  }

  if (action === "delete_plan") {
    const id = Number(body.id);
    const assigned = await db
      .select({ id: merchants.id })
      .from(merchants)
      .where(eq(merchants.planId, id))
      .limit(1);
    if (assigned.length > 0) {
      return NextResponse.json(
        { error: "لا يمكن حذف باقة مرتبطة بتجار حاليين؛ يمكنك تعطيلها بدلاً من ذلك." },
        { status: 400 }
      );
    }
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return NextResponse.json({ ok: true });
  }

  // 3. Platform Payment Methods CRUD
  if (action === "create_payment_method") {
    const nameAr = String(body.nameAr || "").trim();
    const nameEn = String(body.nameEn || "").trim();
    const code = String(body.code || nameEn)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_");
    const type = body.type === "bank" || body.type === "cod" ? body.type : "wallet";

    if (!nameAr || !nameEn || !code) {
      return NextResponse.json({ error: "اسم طريقة الدفع مطلوب" }, { status: 400 });
    }

    const [created] = await db
      .insert(platformPaymentMethods)
      .values({ code, nameAr, nameEn, type, isActive: true })
      .returning();
    return NextResponse.json({ method: created }, { status: 201 });
  }

  if (action === "toggle_payment_method") {
    const id = Number(body.id);
    const isActive = Boolean(body.isActive);
    const [updated] = await db
      .update(platformPaymentMethods)
      .set({ isActive })
      .where(eq(platformPaymentMethods.id, id))
      .returning();
    return NextResponse.json({ method: updated });
  }

  if (action === "update_platform_wallets") {
    const value = body.value;
    await db
      .insert(platformSettings)
      .values({ key: "subscription_wallets", value })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value },
      });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح بالوصول" }, { status: 403 });
  }

  const body = await req.json();
  const merchantId = Number(body.merchantId);
  if (!merchantId) {
    return NextResponse.json({ error: "معرف التاجر مطلوب" }, { status: 400 });
  }

  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1);
  if (!merchant) {
    return NextResponse.json({ error: "التاجر غير موجود" }, { status: 404 });
  }

  if (body.action === "reset_password") {
    const newPassword = String(body.newPassword || "");
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
    }
    await db
      .update(users)
      .set({ passwordHash: hashPassword(newPassword) })
      .where(eq(users.id, merchant.userId));
    return NextResponse.json({ ok: true });
  }

  const updates: Partial<typeof merchants.$inferInsert> = {};

  if (body.status && ["active", "pending", "suspended", "expired"].includes(body.status)) {
    updates.status = body.status;
  }
  if (body.planId) {
    updates.planId = Number(body.planId);
  }
  if (body.extendDays) {
    const days = Number(body.extendDays);
    const base =
      merchant.subscriptionEndsAt && new Date(merchant.subscriptionEndsAt).getTime() > Date.now()
        ? new Date(merchant.subscriptionEndsAt).getTime()
        : Date.now();
    updates.subscriptionEndsAt = new Date(base + days * 24 * 60 * 60 * 1000);
    if (days > 0 && !body.status) {
      updates.status = "active";
    }
  }
  if (body.storeName) updates.storeName = String(body.storeName).trim();
  if (body.city !== undefined) updates.city = String(body.city).trim();

  const [updated] = await db
    .update(merchants)
    .set(updates)
    .where(eq(merchants.id, merchantId))
    .returning();

  return NextResponse.json({ merchant: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "غير مصرح بالوصول" }, { status: 403 });
  }

  const merchantId = Number(req.nextUrl.searchParams.get("merchantId"));
  if (!merchantId) {
    return NextResponse.json({ error: "معرف التاجر مطلوب" }, { status: 400 });
  }

  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1);
  if (!merchant) {
    return NextResponse.json({ error: "التاجر غير موجود" }, { status: 404 });
  }

  // Deleting user cascades to merchant, products, payment methods, subscription requests, orders
  await db.delete(users).where(eq(users.id, merchant.userId));
  return NextResponse.json({ ok: true });
}
