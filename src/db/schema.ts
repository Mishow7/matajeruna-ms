import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"super_admin" | "merchant" | "customer">().notNull().default("customer"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  priceYer: integer("price_yer").notNull(),
  maxProducts: integer("max_products").notNull(),
  maxImagesPerProduct: integer("max_images_per_product").notNull(),
  reportsEnabled: boolean("reports_enabled").notNull().default(false),
  supportLevel: text("support_level").notNull(),
  descriptionAr: text("description_ar"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const merchants = pgTable("merchants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  planId: integer("plan_id")
    .notNull()
    .references(() => subscriptionPlans.id),
  storeName: text("store_name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#0f766e"),
  description: text("description"),
  city: text("city"),
  phone: text("phone"),
  status: text("status")
    .$type<"active" | "pending" | "suspended" | "expired">()
    .notNull()
    .default("pending"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const platformPaymentMethods = pgTable("platform_payment_methods", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  type: text("type").$type<"wallet" | "bank" | "cod">().notNull().default("wallet"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const merchantPaymentMethods = pgTable(
  "merchant_payment_methods",
  {
    id: serial("id").primaryKey(),
    merchantId: integer("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    platformMethodId: integer("platform_method_id")
      .notNull()
      .references(() => platformPaymentMethods.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    accountHolderName: text("account_holder_name"),
    accountNumber: text("account_number"),
    bankName: text("bank_name"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("merchant_platform_method_idx").on(table.merchantId, table.platformMethodId),
  ]
);

export const subscriptionRequests = pgTable("subscription_requests", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id, { onDelete: "cascade" }),
  planId: integer("plan_id")
    .notNull()
    .references(() => subscriptionPlans.id),
  amountYer: integer("amount_yer").notNull(),
  paymentMethodName: text("payment_method_name").notNull(),
  receiptImageUrl: text("receipt_image_url").notNull(),
  transferNote: text("transfer_note"),
  status: text("status")
    .$type<"pending" | "approved" | "rejected">()
    .notNull()
    .default("pending"),
  adminNote: text("admin_note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  originalPrice: integer("original_price").notNull(),
  discountType: text("discount_type")
    .$type<"none" | "percentage" | "fixed">()
    .notNull()
    .default("none"),
  discountValue: integer("discount_value").notNull().default(0),
  finalPrice: integer("final_price").notNull(),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").references(() => users.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerAddress: text("customer_address").notNull(),
  paymentMethodId: integer("payment_method_id").references(() => platformPaymentMethods.id, {
    onDelete: "set null",
  }),
  paymentMethodName: text("payment_method_name").notNull(),
  paymentReference: text("payment_reference"),
  notes: text("notes"),
  totalAmount: integer("total_amount").notNull(),
  status: text("status")
    .$type<"pending" | "confirmed" | "shipped" | "delivered" | "cancelled">()
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  productImage: text("product_image"),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  subtotal: integer("subtotal").notNull(),
});

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
});
