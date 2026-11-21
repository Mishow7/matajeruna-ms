import { NextRequest, NextResponse } from "next/server";
import {
  db,
  merchants,
  products,
  subscriptionPlans,
  platformPaymentMethods,
  merchantPaymentMethods,
  platformSettings,
} from "@/db";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { isMerchantStoreLive, isValidSlug, normalizeSlug } from "@/lib/core";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const { searchParams } = req.nextUrl;
  const checkSlug = searchParams.get("checkSlug");
  const excludeMerchantId = searchParams.get("excludeMerchantId");
  const slug = searchParams.get("slug");

  // 1. Real-time slug availability check
  if (checkSlug !== null) {
    const normalized = normalizeSlug(checkSlug);
    if (!isValidSlug(normalized)) {
      return NextResponse.json({
        available: false,
        normalized,
        reason: "الرابط يجب أن يكون بالإنجليزية (3-40 حرفاً وأرقام أو شرطة فقط وغير محجوز)",
      });
    }
    const existing = await db
      .select({ id: merchants.id })
      .from(merchants)
      .where(
        excludeMerchantId
          ? and(eq(merchants.slug, normalized), ne(merchants.id, Number(excludeMerchantId)))
          : eq(merchants.slug, normalized)
      )
      .limit(1);

    return NextResponse.json({
      available: existing.length === 0,
      normalized,
      reason: existing.length > 0 ? "هذا الرابط مستخدم بالفعل من متجر آخر" : null,
    });
  }

  // 2. Single storefront data
  if (slug) {
    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.slug, slug.toLowerCase()))
      .limit(1);

    if (!merchant) {
      return NextResponse.json({ error: "المتجر غير موجود" }, { status: 404 });
    }

    // Sync expired status if needed
    let currentStatus = merchant.status;
    if (
      currentStatus === "active" &&
      merchant.subscriptionEndsAt &&
      new Date(merchant.subscriptionEndsAt) < new Date()
    ) {
      currentStatus = "expired";
      await db.update(merchants).set({ status: "expired" }).where(eq(merchants.id, merchant.id));
    }

    const isLive = isMerchantStoreLive({
      status: currentStatus,
      subscriptionEndsAt: merchant.subscriptionEndsAt,
    });

    if (!isLive) {
      return NextResponse.json({
        merchant: {
          id: merchant.id,
          storeName: merchant.storeName,
          slug: merchant.slug,
          logoUrl: merchant.logoUrl,
          primaryColor: merchant.primaryColor,
          status: currentStatus,
        },
        isLive: false,
        products: [],
        paymentMethods: [],
      });
    }

    const storeProducts = await db
      .select()
      .from(products)
      .where(and(eq(products.merchantId, merchant.id), eq(products.isActive, true)))
      .orderBy(desc(products.createdAt));

    // Only methods enabled by BOTH platform AND merchant
    const enabledPayments = await db
      .select({
        id: platformPaymentMethods.id,
        code: platformPaymentMethods.code,
        nameAr: platformPaymentMethods.nameAr,
        nameEn: platformPaymentMethods.nameEn,
        type: platformPaymentMethods.type,
        accountHolderName: merchantPaymentMethods.accountHolderName,
        accountNumber: merchantPaymentMethods.accountNumber,
        bankName: merchantPaymentMethods.bankName,
      })
      .from(merchantPaymentMethods)
      .innerJoin(
        platformPaymentMethods,
        eq(merchantPaymentMethods.platformMethodId, platformPaymentMethods.id)
      )
      .where(
        and(
          eq(merchantPaymentMethods.merchantId, merchant.id),
          eq(merchantPaymentMethods.enabled, true),
          eq(platformPaymentMethods.isActive, true)
        )
      )
      .orderBy(asc(platformPaymentMethods.id));

    return NextResponse.json({
      merchant: {
        id: merchant.id,
        storeName: merchant.storeName,
        slug: merchant.slug,
        logoUrl: merchant.logoUrl,
        primaryColor: merchant.primaryColor,
        description: merchant.description,
        city: merchant.city,
        phone: merchant.phone,
        status: currentStatus,
      },
      isLive: true,
      products: storeProducts,
      paymentMethods: enabledPayments,
    });
  }

  // 3. Landing page: active stores + active plans + platform wallet settings
  const allStores = await db
    .select({
      id: merchants.id,
      storeName: merchants.storeName,
      slug: merchants.slug,
      logoUrl: merchants.logoUrl,
      primaryColor: merchants.primaryColor,
      description: merchants.description,
      city: merchants.city,
      status: merchants.status,
      subscriptionEndsAt: merchants.subscriptionEndsAt,
    })
    .from(merchants)
    .orderBy(desc(merchants.createdAt));

  const liveStores = allStores.filter((m) => isMerchantStoreLive(m));

  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(asc(subscriptionPlans.priceYer));

  const [walletSetting] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, "subscription_wallets"))
    .limit(1);

  return NextResponse.json({
    stores: liveStores,
    plans,
    subscriptionWallets: walletSetting?.value ?? null,
  });
}
