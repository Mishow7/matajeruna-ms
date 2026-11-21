import { NextRequest, NextResponse } from "next/server";
import {
  db,
  merchants,
  products,
  orders,
  orderItems,
  platformPaymentMethods,
  merchantPaymentMethods,
} from "@/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getCurrentSession, isMerchantStoreLive } from "@/lib/core";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ orders: [] });
  }

  const customerOrders = await db
    .select({
      id: orders.id,
      merchantId: orders.merchantId,
      storeName: merchants.storeName,
      storeSlug: merchants.slug,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      customerAddress: orders.customerAddress,
      paymentMethodName: orders.paymentMethodName,
      paymentReference: orders.paymentReference,
      totalAmount: orders.totalAmount,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(merchants, eq(orders.merchantId, merchants.id))
    .where(eq(orders.customerId, session.user.id))
    .orderBy(desc(orders.createdAt));

  if (customerOrders.length === 0) {
    return NextResponse.json({ orders: [] });
  }

  const orderIds = customerOrders.map((o) => o.id);
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));

  return NextResponse.json({
    orders: customerOrders.map((o) => ({
      ...o,
      items: items.filter((i) => i.orderId === o.id),
    })),
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  try {
    const session = await getCurrentSession();
    const body = await req.json();

    const merchantId = Number(body.merchantId);
    const paymentMethodId = Number(body.paymentMethodId);
    const customerName = String(body.customerName || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const customerAddress = String(body.customerAddress || "").trim();
    const paymentReference = body.paymentReference ? String(body.paymentReference).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (!merchantId || !paymentMethodId || !customerName || !customerPhone || !customerAddress) {
      return NextResponse.json(
        { error: "يرجى إكمال بيانات المستلم وطريقة الدفع" },
        { status: 400 }
      );
    }

    if (rawItems.length === 0) {
      return NextResponse.json({ error: "سلة التسوق فارغة" }, { status: 400 });
    }

    const [merchant] = await db.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1);
    if (!merchant || !isMerchantStoreLive(merchant)) {
      return NextResponse.json({ error: "هذا المتجر غير متاح حالياً لاستقبال الطلبات" }, { status: 403 });
    }

    // Verify payment method is enabled on both platform & merchant
    const [enabledMethod] = await db
      .select({
        id: platformPaymentMethods.id,
        nameAr: platformPaymentMethods.nameAr,
      })
      .from(merchantPaymentMethods)
      .innerJoin(
        platformPaymentMethods,
        eq(merchantPaymentMethods.platformMethodId, platformPaymentMethods.id)
      )
      .where(
        and(
          eq(merchantPaymentMethods.merchantId, merchantId),
          eq(merchantPaymentMethods.platformMethodId, paymentMethodId),
          eq(merchantPaymentMethods.enabled, true),
          eq(platformPaymentMethods.isActive, true)
        )
      )
      .limit(1);

    if (!enabledMethod) {
      return NextResponse.json(
        { error: "طريقة الدفع المختارة غير مفعّلة لهذا المتجر" },
        { status: 400 }
      );
    }

    const createdOrder = await db.transaction(async (tx) => {
      let totalAmount = 0;
      const preparedItems: Array<{
        productId: number;
        productName: string;
        productImage: string | null;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }> = [];

      for (const item of rawItems) {
        const productId = Number(item.productId);
        const quantity = Math.floor(Number(item.quantity));
        if (!productId || quantity < 1) {
          throw new Error("كمية غير صالحة لأحد المنتجات");
        }

        const [product] = await tx
          .select()
          .from(products)
          .where(and(eq(products.id, productId), eq(products.merchantId, merchantId), eq(products.isActive, true)))
          .limit(1);

        if (!product) {
          throw new Error("أحد المنتجات غير موجود أو غير متاح");
        }
        if (product.stockQuantity < quantity) {
          throw new Error(`الكمية المطلوبة من "${product.name}" غير متوفرة (المتوفر: ${product.stockQuantity})`);
        }

        await tx
          .update(products)
          .set({ stockQuantity: sql`${products.stockQuantity} - ${quantity}` })
          .where(eq(products.id, product.id));

        const subtotal = product.finalPrice * quantity;
        totalAmount += subtotal;
        preparedItems.push({
          productId: product.id,
          productName: product.name,
          productImage: product.images?.[0] ?? null,
          quantity,
          unitPrice: product.finalPrice,
          subtotal,
        });
      }

      const [order] = await tx
        .insert(orders)
        .values({
          merchantId,
          customerId: session?.user?.id ?? null,
          customerName,
          customerPhone,
          customerAddress,
          paymentMethodId: enabledMethod.id,
          paymentMethodName: enabledMethod.nameAr,
          paymentReference,
          notes,
          totalAmount,
          status: "pending",
        })
        .returning();

      await tx.insert(orderItems).values(
        preparedItems.map((pi) => ({
          orderId: order.id,
          ...pi,
        }))
      );

      return { ...order, items: preparedItems };
    });

    return NextResponse.json({ order: createdOrder }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر إتمام الطلب";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
