import {
  db,
  users,
  subscriptionPlans,
  platformPaymentMethods,
  merchants,
  merchantPaymentMethods,
  products,
  orders,
  orderItems,
  subscriptionRequests,
  platformSettings,
} from "@/db";
import { count, eq } from "drizzle-orm";
import { hashPassword } from "./core";

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error("Seed error:", err);
    });
  }
  await seedPromise;
}

async function runSeed() {
  const [{ value: userCount }] = await db.select({ value: count() }).from(users);
  if (userCount > 0) return;

  // 1. Seed Platform Settings (subscription wallet info)
  await db
    .insert(platformSettings)
    .values({
      key: "subscription_wallets",
      value: {
        instructions:
          "يرجى تحويل رسوم الباقة الشهرية إلى أحد حسابات منصة متاجرنا التالية، ثم رفع صورة إيصال التحويل ليتم تفعيل متجرك.",
        accounts: [
          { method: "جوالي (Jawali)", accountName: "منصة متاجرنا للتجارة", accountNumber: "777000111" },
          { method: "جيب (Jaib)", accountName: "منصة متاجرنا للتجارة", accountNumber: "777000222" },
          { method: "بنك الكريمي", accountName: "شركة متاجرنا اليمن", accountNumber: "1200458900" },
        ],
      },
    })
    .onConflictDoNothing();

  // 2. Seed Subscription Plans
  const insertedPlans = await db
    .insert(subscriptionPlans)
    .values([
      {
        nameAr: "الباقة الأساسية",
        nameEn: "Basic",
        priceYer: 5000,
        maxProducts: 15,
        maxImagesPerProduct: 2,
        reportsEnabled: false,
        supportLevel: "دعم عبر البريد والواتساب",
        descriptionAr: "مناسبة للمتاجر الناشئة والأسر المنتجة للبدء بالبيع أونلاين.",
        isActive: true,
      },
      {
        nameAr: "الباقة الاحترافية",
        nameEn: "Pro",
        priceYer: 12000,
        maxProducts: 60,
        maxImagesPerProduct: 5,
        reportsEnabled: true,
        supportLevel: "دعم فني أولوية عالية",
        descriptionAr: "الخيار الأفضل لتجار التجزئة مع تقارير مبيعات وعدد صور أكبر للمنتجات.",
        isActive: true,
      },
      {
        nameAr: "الباقة المتقدمة",
        nameEn: "Premium",
        priceYer: 25000,
        maxProducts: 300,
        maxImagesPerProduct: 10,
        reportsEnabled: true,
        supportLevel: "دعم VIP مباشر 24/7",
        descriptionAr: "للمتاجر الكبرى والعلامات التجارية مع سعة منتجات ضخمة ودعم متواصل.",
        isActive: true,
      },
    ])
    .returning();

  const basicPlan = insertedPlans[0];
  const proPlan = insertedPlans[1];
  const premiumPlan = insertedPlans[2];

  // 3. Seed Yemen Platform Payment Methods (all active by default)
  const insertedMethods = await db
    .insert(platformPaymentMethods)
    .values([
      { code: "jaib", nameAr: "جيب", nameEn: "Jaib", type: "wallet", isActive: true },
      { code: "jawali", nameAr: "جوالي", nameEn: "Jawali", type: "wallet", isActive: true },
      { code: "kuraimi", nameAr: "كريمي (حاسب/جوال)", nameEn: "Kuraimi Cash", type: "wallet", isActive: true },
      { code: "mahfazati", nameAr: "محفظتي", nameEn: "Mahfazati", type: "wallet", isActive: true },
      { code: "bank_transfer", nameAr: "تحويل بنكي", nameEn: "Bank Transfer", type: "bank", isActive: true },
      { code: "cod", nameAr: "الدفع نقداً عند الاستلام", nameEn: "Cash on Delivery", type: "cod", isActive: true },
    ])
    .returning();

  const byCode = Object.fromEntries(insertedMethods.map((m) => [m.code, m]));

  // 4. Seed Users
  const [adminUser, m1User, m2User, m3User, customerUser] = await db
    .insert(users)
    .values([
      {
        name: "مدير منصة متاجرنا",
        email: "admin@matajeruna.com",
        phone: "777000001",
        passwordHash: hashPassword("admin123"),
        role: "super_admin",
      },
      {
        name: "عبدالله الإرياني",
        email: "coffee@matajeruna.com",
        phone: "771234567",
        passwordHash: hashPassword("merchant123"),
        role: "merchant",
      },
      {
        name: "سالم باوزير",
        email: "tech@matajeruna.com",
        phone: "733456789",
        passwordHash: hashPassword("merchant123"),
        role: "merchant",
      },
      {
        name: "فؤاد الشرعبي",
        email: "honey@matajeruna.com",
        phone: "775554433",
        passwordHash: hashPassword("merchant123"),
        role: "merchant",
      },
      {
        name: "أحمد الحداد",
        email: "customer@matajeruna.com",
        phone: "778889900",
        passwordHash: hashPassword("customer123"),
        role: "customer",
      },
    ])
    .returning();

  const now = Date.now();
  const day = 1000 * 60 * 60 * 24;

  // 5. Seed Merchants
  const [coffeeStore, techStore, honeyStore] = await db
    .insert(merchants)
    .values([
      {
        userId: m1User.id,
        planId: proPlan.id,
        storeName: "بن حراز الأصيل",
        slug: "sanaa-coffee",
        logoUrl: "/images/coffee.jpg",
        primaryColor: "#7c2d12",
        description: "أجود أنواع البن اليمني المحمص والهيل والعسل من مرتفعات حراز وصنعاء.",
        city: "صنعاء",
        phone: "771234567",
        status: "active",
        subscriptionEndsAt: new Date(now + 24 * day),
      },
      {
        userId: m2User.id,
        planId: premiumPlan.id,
        storeName: "عدن تك للإلكترونيات",
        slug: "aden-tech",
        logoUrl: "/images/electronics.jpg",
        primaryColor: "#0f766e",
        description: "أحدث الأجهزة الذكية والسماعات والإكسسوارات الأصلية مع توصيل سريع لجميع المحافظات.",
        city: "عدن",
        phone: "733456789",
        status: "active",
        subscriptionEndsAt: new Date(now + 4 * day), // Expiring soon alert!
      },
      {
        userId: m3User.id,
        planId: basicPlan.id,
        storeName: "مناحل دوعن وتعز",
        slug: "taiz-honey",
        logoUrl: "/images/honey.jpg",
        primaryColor: "#b45309",
        description: "عسل السدر الدوعني الملكي وعسل السمرة الطبيعي المفحوص مخبرياً.",
        city: "تعز",
        phone: "775554433",
        status: "pending",
        subscriptionEndsAt: null,
      },
    ])
    .returning();

  // 6. Seed Merchant Payment Methods (Only selected ones enabled!)
  await db.insert(merchantPaymentMethods).values([
    // Sanaa Coffee: Jawali, Kuraimi, COD enabled
    {
      merchantId: coffeeStore.id,
      platformMethodId: byCode.jawali.id,
      enabled: true,
      accountHolderName: "عبدالله محمد الإرياني",
      accountNumber: "771234567",
    },
    {
      merchantId: coffeeStore.id,
      platformMethodId: byCode.kuraimi.id,
      enabled: true,
      accountHolderName: "عبدالله محمد الإرياني",
      accountNumber: "300451298",
    },
    {
      merchantId: coffeeStore.id,
      platformMethodId: byCode.cod.id,
      enabled: true,
    },
    // Aden Tech: Jaib, Bank Transfer, COD enabled
    {
      merchantId: techStore.id,
      platformMethodId: byCode.jaib.id,
      enabled: true,
      accountHolderName: "سالم عمر باوزير",
      accountNumber: "733456789",
    },
    {
      merchantId: techStore.id,
      platformMethodId: byCode.bank_transfer.id,
      enabled: true,
      accountHolderName: "شركة عدن تك للتجارة",
      accountNumber: "1029384756",
      bankName: "بنك التضامن الإسلامي",
    },
    {
      merchantId: techStore.id,
      platformMethodId: byCode.cod.id,
      enabled: true,
    },
  ]);

  // 7. Seed Products (with multiple images & discounts)
  const insertedProducts = await db
    .insert(products)
    .values([
      {
        merchantId: coffeeStore.id,
        name: "بن حراز الفاخر - تحميص وسط (1 كجم)",
        description:
          "بن يمني صافي مقطوف يدوياً من مدرجات جبل حراز، محمص بعناية للحفاظ على النكهة الغنية والرائحة الأصيلة.",
        category: "قهوة وبن",
        images: ["/images/coffee.jpg", "/images/spices.jpg"],
        originalPrice: 12000,
        discountType: "fixed",
        discountValue: 2000,
        finalPrice: 10000,
        stockQuantity: 45,
        isActive: true,
      },
      {
        merchantId: coffeeStore.id,
        name: "عسل سدر دوعني درجة أولى (نصف كيلو)",
        description: "عسل سدر طبيعي 100% مضمون من مناحل حضرموت، مثالي للمناعة والهدايا الفاخرة.",
        category: "عسل طبيعي",
        images: ["/images/honey.jpg", "/images/coffee.jpg"],
        originalPrice: 25000,
        discountType: "percentage",
        discountValue: 10,
        finalPrice: 22500,
        stockQuantity: 18,
        isActive: true,
      },
      {
        merchantId: coffeeStore.id,
        name: "خلطة بهارات القهوة الملكية واللبان",
        description: "توليفة هيل وزعفران ولبان حوجري مختارة بعناية لإعداد القهوة اليمنية التقليدية.",
        category: "بهارات وعطور",
        images: ["/images/spices.jpg", "/images/oud.jpg"],
        originalPrice: 6500,
        discountType: "none",
        discountValue: 0,
        finalPrice: 6500,
        stockQuantity: 60,
        isActive: true,
      },
      {
        merchantId: coffeeStore.id,
        name: "دهن عود ملكي معتق (ربع تولة)",
        description: "عطر دهن عود فاخر بعبوة ذهبية أنيقة وثبات يدوم طويلاً.",
        category: "بهارات وعطور",
        images: ["/images/oud.jpg", "/images/spices.jpg"],
        originalPrice: 18000,
        discountType: "fixed",
        discountValue: 3000,
        finalPrice: 15000,
        stockQuantity: 12,
        isActive: true,
      },
      {
        merchantId: techStore.id,
        name: "سماعة لاسلكية برو عازلة للضوضاء",
        description: "سماعة بلوتوث عالية الدقة مع بطارية تدوم 30 ساعة وشحن سريع USB-C.",
        category: "سماعات",
        images: ["/images/electronics.jpg"],
        originalPrice: 35000,
        discountType: "percentage",
        discountValue: 20,
        finalPrice: 28000,
        stockQuantity: 25,
        isActive: true,
      },
      {
        merchantId: techStore.id,
        name: "ساعة ذكية رياضية مقاومة للماء",
        description: "تتبع نبضات القلب والخطوات وإشعارات الهاتف باللغة العربية بالكامل.",
        category: "ساعات ذكية",
        images: ["/images/electronics.jpg"],
        originalPrice: 42000,
        discountType: "fixed",
        discountValue: 4000,
        finalPrice: 38000,
        stockQuantity: 15,
        isActive: true,
      },
      {
        merchantId: honeyStore.id,
        name: "عسل سدر ملكي صافي (1 كيلو)",
        description: "عسل سدر تعزي صافي معبأ في عبوة زجاجية محكمة الإغلاق.",
        category: "عسل",
        images: ["/images/honey.jpg"],
        originalPrice: 45000,
        discountType: "none",
        discountValue: 0,
        finalPrice: 45000,
        stockQuantity: 10,
        isActive: true,
      },
    ])
    .returning();

  // 8. Seed Orders
  const [order1] = await db
    .insert(orders)
    .values({
      merchantId: coffeeStore.id,
      customerId: customerUser.id,
      customerName: "أحمد الحداد",
      customerPhone: "778889900",
      customerAddress: "صنعاء - شارع حدة - جوار سوبرماركت الهدى",
      paymentMethodId: byCode.jawali.id,
      paymentMethodName: "جوالي",
      paymentReference: "JWL-984512",
      notes: "التوصيل بعد العصر",
      totalAmount: 32500,
      status: "confirmed",
    })
    .returning();

  await db.insert(orderItems).values([
    {
      orderId: order1.id,
      productId: insertedProducts[0].id,
      productName: insertedProducts[0].name,
      productImage: insertedProducts[0].images[0],
      quantity: 1,
      unitPrice: 10000,
      subtotal: 10000,
    },
    {
      orderId: order1.id,
      productId: insertedProducts[1].id,
      productName: insertedProducts[1].name,
      productImage: insertedProducts[1].images[0],
      quantity: 1,
      unitPrice: 22500,
      subtotal: 22500,
    },
  ]);

  const [order2] = await db
    .insert(orders)
    .values({
      merchantId: techStore.id,
      customerId: null,
      customerName: "نادر المقطري",
      customerPhone: "736112233",
      customerAddress: "عدن - المنصورة - بلوك 14",
      paymentMethodId: byCode.cod.id,
      paymentMethodName: "الدفع نقداً عند الاستلام",
      totalAmount: 28000,
      status: "pending",
    })
    .returning();

  await db.insert(orderItems).values([
    {
      orderId: order2.id,
      productId: insertedProducts[4].id,
      productName: insertedProducts[4].name,
      productImage: insertedProducts[4].images[0],
      quantity: 1,
      unitPrice: 28000,
      subtotal: 28000,
    },
  ]);

  // 9. Seed Subscription Requests (Approved for active stores + 1 Pending for Taiz Honey)
  await db.insert(subscriptionRequests).values([
    {
      merchantId: coffeeStore.id,
      planId: proPlan.id,
      amountYer: proPlan.priceYer,
      paymentMethodName: "جوالي (Jawali)",
      receiptImageUrl: "/images/coffee.jpg",
      transferNote: "تم التحويل من رقم 771234567 - مرجع 55210",
      status: "approved",
      adminNote: "تمت مراجعة الإيصال وتفعيل الباقة الاحترافية",
      reviewedAt: new Date(now - 6 * day),
      createdAt: new Date(now - 6 * day),
    },
    {
      merchantId: techStore.id,
      planId: premiumPlan.id,
      amountYer: premiumPlan.priceYer,
      paymentMethodName: "بنك الكريمي",
      receiptImageUrl: "/images/electronics.jpg",
      transferNote: "تحويل كريمي رقم 882104",
      status: "approved",
      adminNote: "موافق عليه",
      reviewedAt: new Date(now - 26 * day),
      createdAt: new Date(now - 26 * day),
    },
    {
      merchantId: honeyStore.id,
      planId: basicPlan.id,
      amountYer: basicPlan.priceYer,
      paymentMethodName: "جيب (Jaib)",
      receiptImageUrl: "/images/honey.jpg",
      transferNote: "تم تحويل 5000 ريال للاشتراك الشهري - رقم العملية 774102",
      status: "pending",
      createdAt: new Date(now - 1 * day),
    },
  ]);

  // Ensure unused variable warning avoided
  void adminUser;
  void eq;
}
