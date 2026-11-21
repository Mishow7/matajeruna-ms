import { NextRequest, NextResponse } from "next/server";
import { db, products, subscriptionPlans } from "@/db";
import { and, count, eq } from "drizzle-orm";
import { calculateFinalPrice, getCurrentSession } from "@/lib/core";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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

  if (!plan) {
    return NextResponse.json({ error: "تعذر التحقق من باقة الاشتراك" }, { status: 400 });
  }

  const [{ value: currentCount }] = await db
    .select({ value: count() })
    .from(products)
    .where(eq(products.merchantId, merchant.id));

  if (currentCount >= plan.maxProducts) {
    return NextResponse.json(
      {
        error: `وصلت للحد الأقصى للمنتجات في باقتك (${plan.maxProducts} منتج). يرجى ترقية الباقة لإضافة المزيد.`,
      },
      { status: 403 }
    );
  }

  const body = await req.json();
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const category = String(body.category || "عام").trim();
  const images = Array.isArray(body.images)
    ? body.images.map((i: unknown) => String(i).trim()).filter(Boolean)
    : [];
  const originalPrice = Math.max(0, Math.round(Number(body.originalPrice) || 0));
  const discountType = (
    body.discountType === "percentage" || body.discountType === "fixed" ? body.discountType : "none"
  ) as "none" | "percentage" | "fixed";
  const discountValue = Math.max(0, Math.round(Number(body.discountValue) || 0));
  const stockQuantity = Math.max(0, Math.floor(Number(body.stockQuantity) || 0));
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

  if (!name || originalPrice <= 0) {
    return NextResponse.json({ error: "اسم المنتج والسعر الأصلي مطلوبان" }, { status: 400 });
  }

  if (images.length === 0) {
    return NextResponse.json({ error: "يرجى إضافة صورة واحدة على الأقل للمنتج" }, { status: 400 });
  }

  if (images.length > plan.maxImagesPerProduct) {
    return NextResponse.json(
      {
        error: `باقتك الحالية (${plan.nameAr}) تسمح بحد أقصى ${plan.maxImagesPerProduct} صور لكل منتج.`,
      },
      { status: 403 }
    );
  }

  const finalPrice = calculateFinalPrice(originalPrice, discountType, discountValue);

  const [created] = await db
    .insert(products)
    .values({
      merchantId: merchant.id,
      name,
      description,
      category,
      images,
      originalPrice,
      discountType,
      discountValue,
      finalPrice,
      stockQuantity,
      isActive,
    })
    .returning();

  return NextResponse.json({ product: created }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
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

  const body = await req.json();
  const id = Number(body.id);
  if (!id) {
    return NextResponse.json({ error: "معرف المنتج مطلوب" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.merchantId, merchant.id)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
  }

  const name = body.name !== undefined ? String(body.name).trim() : existing.name;
  const description =
    body.description !== undefined ? String(body.description).trim() : existing.description;
  const category = body.category !== undefined ? String(body.category).trim() : existing.category;
  const images = Array.isArray(body.images)
    ? body.images.map((i: unknown) => String(i).trim()).filter(Boolean)
    : existing.images;
  const originalPrice =
    body.originalPrice !== undefined
      ? Math.max(0, Math.round(Number(body.originalPrice) || 0))
      : existing.originalPrice;
  const discountType = (
    body.discountType === "percentage" ||
    body.discountType === "fixed" ||
    body.discountType === "none"
      ? body.discountType
      : existing.discountType
  ) as "none" | "percentage" | "fixed";
  const discountValue =
    body.discountValue !== undefined
      ? Math.max(0, Math.round(Number(body.discountValue) || 0))
      : existing.discountValue;
  const stockQuantity =
    body.stockQuantity !== undefined
      ? Math.max(0, Math.floor(Number(body.stockQuantity) || 0))
      : existing.stockQuantity;
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive;

  if (plan && images.length > plan.maxImagesPerProduct) {
    return NextResponse.json(
      { error: `باقتك تسمح بحد أقصى ${plan.maxImagesPerProduct} صور لكل منتج.` },
      { status: 403 }
    );
  }

  const finalPrice = calculateFinalPrice(originalPrice, discountType, discountValue);

  const [updated] = await db
    .update(products)
    .set({
      name,
      description,
      category,
      images,
      originalPrice,
      discountType,
      discountValue,
      finalPrice,
      stockQuantity,
      isActive,
    })
    .where(and(eq(products.id, id), eq(products.merchantId, merchant.id)))
    .returning();

  return NextResponse.json({ product: updated });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const session = await getCurrentSession();
  if (!session || session.user.role !== "merchant" || !session.merchant) {
    return NextResponse.json({ error: "غير مصرح بالوصول" }, { status: 401 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "معرف المنتج مطلوب" }, { status: 400 });
  }

  const deleted = await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.merchantId, session.merchant.id)))
    .returning({ id: products.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
