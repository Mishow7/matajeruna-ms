"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Store,
  ShieldCheck,
  Wallet,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  Layers,
  TrendingUp,
  LogIn,
  UserPlus,
  LayoutDashboard,
  ShoppingBag,
  MapPin,
  LogOut,
  Package,
} from "lucide-react";
import { formatYer, formatDateAr, ORDER_STATUS_META } from "@/lib/client-utils";

interface PublicStore {
  id: number;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  description: string | null;
  city: string | null;
}

interface Plan {
  id: number;
  nameAr: string;
  nameEn: string;
  priceYer: number;
  maxProducts: number;
  maxImagesPerProduct: number;
  reportsEnabled: boolean;
  supportLevel: string;
  descriptionAr: string | null;
}

interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: "super_admin" | "merchant" | "customer";
}

interface CustomerOrder {
  id: number;
  storeName: string;
  storeSlug: string;
  totalAmount: number;
  paymentMethodName: string;
  status: string;
  createdAt: string;
  items: Array<{ productName: string; quantity: number; subtotal: number }>;
}

const YEMEN_PAYMENT_BADGES = [
  { name: "جيب (Jaib)", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { name: "جوالي (Jawali)", color: "bg-sky-50 text-sky-700 border-sky-200" },
  { name: "كريمي (Kuraimi)", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { name: "محفظتي (Mahfazati)", color: "bg-violet-50 text-violet-700 border-violet-200" },
  { name: "تحويل بنكي", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { name: "الدفع نقداً", color: "bg-stone-100 text-stone-700 border-stone-300" },
];

export default function HomePage() {
  const [stores, setStores] = useState<PublicStore[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [merchantSlug, setMerchantSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [storesRes, authRes] = await Promise.all([
          fetch("/api/stores"),
          fetch("/api/auth"),
        ]);
        if (storesRes.ok) {
          const data = await storesRes.json();
          setStores(data.stores || []);
          setPlans(data.plans || []);
        }
        if (authRes.ok) {
          const authData = await authRes.json();
          setUser(authData.user || null);
          setMerchantSlug(authData.merchant?.slug || null);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleLogout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setUser(null);
    setMerchantSlug(null);
  }

  async function openCustomerOrders() {
    setShowOrdersModal(true);
    const res = await fetch("/api/orders");
    if (res.ok) {
      const data = await res.json();
      setCustomerOrders(data.orders || []);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-900 block leading-none">
                متاجرنا
              </span>
              <span className="text-[11px] font-semibold text-teal-700 tracking-wide">
                MATAJERUNA
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#stores" className="hover:text-teal-700 transition">
              المتاجر النشطة
            </a>
            <a href="#payments" className="hover:text-teal-700 transition">
              طرق الدفع اليمنية
            </a>
            <a href="#pricing" className="hover:text-teal-700 transition">
              باقات الاشتراك
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {user.role === "super_admin" && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    لوحة الأدمن
                  </Link>
                )}
                {user.role === "merchant" && (
                  <>
                    <Link
                      href="/merchant"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      لوحة التاجر
                    </Link>
                    {merchantSlug && (
                      <Link
                        href={`/${merchantSlug}`}
                        className="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-stone-200 bg-white text-slate-700 text-sm font-medium hover:bg-stone-100"
                      >
                        متجري
                      </Link>
                    )}
                  </>
                )}
                {user.role === "customer" && (
                  <button
                    onClick={openCustomerOrders}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition"
                  >
                    <Package className="w-4 h-4" />
                    طلباتي
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  title="تسجيل الخروج"
                  className="p-2 rounded-xl border border-stone-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-slate-700 text-sm font-semibold hover:bg-stone-100 transition"
                >
                  <LogIn className="w-4 h-4" />
                  تسجيل الدخول
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 shadow-sm transition"
                >
                  <UserPlus className="w-4 h-4" />
                  افتح متجرك
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-bl from-teal-900 via-teal-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-teal-100 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-amber-300" />
              منصة التجارة الإلكترونية الأولى المصممة لتجار اليمن
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight">
              أطلق متجرك الإلكتروني المستقل مع{" "}
              <span className="text-amber-300">متاجرنا</span> في دقائق
            </h1>
            <p className="text-teal-50/90 text-base sm:text-lg leading-relaxed max-w-2xl">
              احصل على رابط متجر خاص بك، أدر منتجاتك بعدة صور وخصومات، واستلم مدفوعات عملائك
              مباشرة عبر محافظ اليمن المحلية (جيب، جوالي، كريمي، محفظتي، تحويل بنكي، أو الدفع نقداً)
              دون أي عمولة على المبيعات.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-400 text-slate-900 font-bold hover:bg-amber-300 shadow-lg transition"
              >
                ابدأ متجرك الآن
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <a
                href="#stores"
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition"
              >
                تصفح المتاجر التجريبية
              </a>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <span className="text-sm font-bold text-amber-300">مثال لرابط متجرك المستقل</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-400/20 text-emerald-200 font-semibold">
                  متاح للتسجيل
                </span>
              </div>
              <div
                dir="ltr"
                className="bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-teal-200 flex items-center justify-between"
              >
                <span>matajeruna.com/sanaa-coffee</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white/10 rounded-xl p-3.5">
                  <Wallet className="w-5 h-5 text-amber-300 mb-1.5" />
                  <p className="text-sm font-bold">مبيعاتك لمحفظتك مباشرة</p>
                  <p className="text-xs text-teal-100/80 mt-0.5">
                    تُحوّل أموال العملاء لحساباتك التي تفعلها بنفسك
                  </p>
                </div>
                <div className="bg-white/10 rounded-xl p-3.5">
                  <TrendingUp className="w-5 h-5 text-emerald-300 mb-1.5" />
                  <p className="text-sm font-bold">دعم الخصومات والصور</p>
                  <p className="text-xs text-teal-100/80 mt-0.5">
                    حساب السعر بعد الخصم تلقائياً بالريال اليمني
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Yemeni Payment Methods Banner */}
      <section id="payments" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full">
        <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                طرق دفع محلية مخصصة للسوق اليمني 🇾🇪
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                يفعّل كل تاجر الطرق التي تناسبه ويضيف رقم محفظته لتظهر لعملائه عند الشراء.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {YEMEN_PAYMENT_BADGES.map((b) => (
              <span
                key={b.name}
                className={`px-4 py-2 rounded-xl border text-sm font-bold ${b.color}`}
              >
                {b.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Active Demo Stores Directory */}
      <section id="stores" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">تصفح المتاجر النشطة</h2>
            <p className="text-sm text-slate-600 mt-1">
              جرّب التسوق من المتاجر الحية عبر روابطها المستقلة الآن
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 rounded-2xl bg-white border border-stone-200 animate-pulse" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
            <ShoppingBag className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">لا توجد متاجر نشطة حالياً</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <Link
                key={store.id}
                href={`/${store.slug}`}
                className="group bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md hover:border-teal-300 transition flex flex-col"
              >
                <div
                  className="h-24 relative flex items-end px-5 pb-3"
                  style={{ backgroundColor: store.primaryColor || "#0f766e" }}
                >
                  <div className="w-16 h-16 rounded-2xl bg-white border-2 border-white shadow-md overflow-hidden translate-y-6 flex items-center justify-center shrink-0">
                    {store.logoUrl ? (
                      <img
                        src={store.logoUrl}
                        alt={store.storeName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store className="w-7 h-7 text-teal-700" />
                    )}
                  </div>
                </div>
                <div className="pt-9 px-5 pb-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-lg text-slate-900 group-hover:text-teal-700 transition">
                        {store.storeName}
                      </h3>
                      {store.city && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-stone-100 px-2.5 py-1 rounded-full">
                          <MapPin className="w-3 h-3" />
                          {store.city}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-teal-700 mt-1" dir="ltr">
                      /{store.slug}
                    </p>
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                      {store.description || "متجر إلكتروني متكامل على منصة متاجرنا"}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-sm font-semibold text-teal-700">
                    <span>دخول المتجر والتسوق</span>
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Subscription Plans */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 py-14 w-full">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            <Layers className="w-3.5 h-3.5" />
            باقات شهرية مرنة بالريال اليمني
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
            اختر الباقة المناسبة لنشاطك التجاري
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            اشتراك شهري واضح بدون عمولة على مبيعاتك. ادفع عبر المحافظ اليمنية وارفع الإيصال لتفعيل متجرك.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, idx) => {
            const isPopular = idx === 1;
            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-6 flex flex-col justify-between transition ${
                  isPopular
                    ? "bg-slate-900 text-white border-2 border-teal-500 shadow-xl"
                    : "bg-white text-slate-900 border border-stone-200 shadow-sm"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-xl">{plan.nameAr}</h3>
                    {isPopular && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-500 text-white">
                        الأكثر طلباً
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${isPopular ? "text-slate-300" : "text-slate-500"}`}>
                    {plan.descriptionAr}
                  </p>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-3xl font-extrabold">{formatYer(plan.priceYer)}</span>
                    <span className={`text-xs ${isPopular ? "text-slate-400" : "text-slate-500"}`}>
                      / شهرياً
                    </span>
                  </div>

                  <ul className="mt-6 space-y-3 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      <span>حتى {plan.maxProducts} منتج في المتجر</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      <span>حتى {plan.maxImagesPerProduct} صور لكل منتج</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      <span>
                        {plan.reportsEnabled ? "تقارير المبيعات مفعّلة" : "لوحة طلبات أساسية"}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                      <span>{plan.supportLevel}</span>
                    </li>
                  </ul>
                </div>

                <Link
                  href={`/register?plan=${plan.id}`}
                  className={`mt-8 w-full text-center py-3 rounded-xl font-bold text-sm transition ${
                    isPopular
                      ? "bg-teal-500 hover:bg-teal-400 text-white"
                      : "bg-teal-700 hover:bg-teal-800 text-white"
                  }`}
                >
                  اشترك في {plan.nameAr}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-stone-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Store className="w-4 h-4 text-teal-700" />
            <span>Matajeruna - متاجرنا © {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-teal-700">
              تسجيل الدخول
            </Link>
            <Link href="/register" className="hover:text-teal-700">
              إنشاء متجر جديد
            </Link>
          </div>
        </div>
      </footer>

      {/* Customer Orders Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="font-bold text-lg">سجل طلباتي</h3>
              <button
                onClick={() => setShowOrdersModal(false)}
                className="text-sm text-slate-500 hover:text-slate-900"
              >
                إغلاق
              </button>
            </div>
            {customerOrders.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">لم تقم بأي طلبات بعد.</p>
            ) : (
              <div className="space-y-3">
                {customerOrders.map((ord) => {
                  const meta = ORDER_STATUS_META[ord.status] || ORDER_STATUS_META.pending;
                  return (
                    <div key={ord.id} className="border border-stone-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Link
                          href={`/${ord.storeSlug}`}
                          className="font-bold text-teal-700 hover:underline"
                        >
                          {ord.storeName} (#{ord.id})
                        </Link>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-4">
                        <span>الدفع: {ord.paymentMethodName}</span>
                        <span>التاريخ: {formatDateAr(ord.createdAt)}</span>
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        الإجمالي: {formatYer(ord.totalAmount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
