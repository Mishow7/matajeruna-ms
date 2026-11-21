"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  Settings,
  Crown,
  Store,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Upload,
  X,
  Menu,
  CheckCircle2,
  XCircle,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import {
  formatDateAr,
  formatYer,
  MERCHANT_STATUS_META,
  ORDER_STATUS_META,
  readImageFileAsDataUrl,
} from "@/lib/client-utils";

type TabId = "overview" | "products" | "orders" | "payments" | "store" | "subscription";

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

interface Merchant {
  id: number;
  planId: number;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  description: string | null;
  city: string | null;
  phone: string | null;
  status: string;
  subscriptionEndsAt: string | null;
}

interface Product {
  id: number;
  name: string;
  description: string | null;
  category: string;
  images: string[];
  originalPrice: number;
  discountType: "none" | "percentage" | "fixed";
  discountValue: number;
  finalPrice: number;
  stockQuantity: number;
  isActive: boolean;
}

interface Order {
  id: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethodName: string;
  paymentReference: string | null;
  notes: string | null;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: Array<{
    id: number;
    productName: string;
    productImage: string | null;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

interface PaymentMethodRow {
  platformMethodId: number;
  code: string;
  nameAr: string;
  nameEn: string;
  type: "wallet" | "bank" | "cod";
  enabled: boolean;
  accountHolderName: string;
  accountNumber: string;
  bankName: string;
}

interface SubRequest {
  id: number;
  planId: number;
  planNameAr: string;
  amountYer: number;
  paymentMethodName: string;
  receiptImageUrl: string;
  transferNote: string | null;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  createdAt: string;
}

interface PlatformWallets {
  instructions?: string;
  accounts?: Array<{ method: string; accountName: string; accountNumber: string }>;
}

const COLOR_PRESETS = ["#0f766e", "#7c2d12", "#b45309", "#1d4ed8", "#7e22ce", "#be123c", "#1e293b"];

export default function MerchantDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [subRequests, setSubRequests] = useState<SubRequest[]>([]);
  const [wallets, setWallets] = useState<PlatformWallets | null>(null);
  const [copiedSlug, setCopiedSlug] = useState(false);

  // Product Modal State
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pCategory, setPCategory] = useState("عام");
  const [pImages, setPImages] = useState<string[]>([]);
  const [pImageUrlInput, setPImageUrlInput] = useState("");
  const [pOriginalPrice, setPOriginalPrice] = useState("5000");
  const [pDiscountType, setPDiscountType] = useState<"none" | "percentage" | "fixed">("none");
  const [pDiscountValue, setPDiscountValue] = useState("0");
  const [pStock, setPStock] = useState("10");
  const [pActive, setPActive] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);

  // Store Settings Form State
  const [sName, setSName] = useState("");
  const [sSlug, setSSlug] = useState("");
  const [sColor, setSColor] = useState("#0f766e");
  const [sLogo, setSLogo] = useState("");
  const [sDesc, setSDesc] = useState("");
  const [sCity, setSCity] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [slugCheck, setSlugCheck] = useState<{
    checking: boolean;
    available: boolean | null;
    reason: string | null;
  }>({ checking: false, available: null, reason: null });
  const [savingStore, setSavingStore] = useState(false);
  const [savingPayments, setSavingPayments] = useState(false);

  // Subscription Renewal Form
  const [subPlanId, setSubPlanId] = useState<number>(0);
  const [subMethod, setSubMethod] = useState("جوالي (Jawali)");
  const [subReceipt, setSubReceipt] = useState("");
  const [subNote, setSubNote] = useState("");
  const [submittingSub, setSubmittingSub] = useState(false);

  const showToast = useCallback((type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/merchant");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setMerchant(data.merchant);
      setPlan(data.plan);
      setAllPlans(data.allPlans || []);
      setProducts(data.products || []);
      setOrders(data.orders || []);
      setPaymentMethods(data.paymentMethods || []);
      setSubRequests(data.subscriptionRequests || []);
      setWallets(data.subscriptionWallets || null);

      if (data.merchant) {
        setSName(data.merchant.storeName || "");
        setSSlug(data.merchant.slug || "");
        setSColor(data.merchant.primaryColor || "#0f766e");
        setSLogo(data.merchant.logoUrl || "");
        setSDesc(data.merchant.description || "");
        setSCity(data.merchant.city || "");
        setSPhone(data.merchant.phone || "");
        setSubPlanId(data.merchant.planId);
      }
    } catch {
      showToast("err", "تعذر تحميل بيانات لوحة التحكم");
    } finally {
      setLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Real-time slug check when editing store settings
  useEffect(() => {
    if (!merchant || !sSlug.trim() || sSlug.trim().toLowerCase() === merchant.slug) {
      setSlugCheck({ checking: false, available: null, reason: null });
      return;
    }
    const timer = setTimeout(async () => {
      setSlugCheck({ checking: true, available: null, reason: null });
      try {
        const res = await fetch(
          `/api/stores?checkSlug=${encodeURIComponent(sSlug)}&excludeMerchantId=${merchant.id}`
        );
        const data = await res.json();
        setSlugCheck({
          checking: false,
          available: Boolean(data.available),
          reason: data.reason || null,
        });
      } catch {
        setSlugCheck({ checking: false, available: null, reason: null });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [sSlug, merchant]);

  const computedPreviewFinalPrice = useMemo(() => {
    const orig = Math.max(0, Math.round(Number(pOriginalPrice) || 0));
    const val = Math.max(0, Math.round(Number(pDiscountValue) || 0));
    if (pDiscountType === "percentage") {
      return Math.max(0, Math.round(orig - (orig * Math.min(100, val)) / 100));
    }
    if (pDiscountType === "fixed") {
      return Math.max(0, orig - val);
    }
    return orig;
  }, [pOriginalPrice, pDiscountType, pDiscountValue]);

  async function handleLogout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
  }

  function openAddProduct() {
    setEditingProduct(null);
    setPName("");
    setPDesc("");
    setPCategory("عام");
    setPImages([]);
    setPImageUrlInput("");
    setPOriginalPrice("5000");
    setPDiscountType("none");
    setPDiscountValue("0");
    setPStock("10");
    setPActive(true);
    setProductModalOpen(true);
  }

  function openEditProduct(p: Product) {
    setEditingProduct(p);
    setPName(p.name);
    setPDesc(p.description || "");
    setPCategory(p.category || "عام");
    setPImages(p.images || []);
    setPImageUrlInput("");
    setPOriginalPrice(String(p.originalPrice));
    setPDiscountType(p.discountType || "none");
    setPDiscountValue(String(p.discountValue || 0));
    setPStock(String(p.stockQuantity));
    setPActive(p.isActive);
    setProductModalOpen(true);
  }

  async function handleProductImagesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const maxAllowed = plan?.maxImagesPerProduct || 5;
    const remaining = maxAllowed - pImages.length;
    if (remaining <= 0) {
      showToast("err", `الحد الأقصى للصور في باقتك هو ${maxAllowed} صور لكل منتج`);
      return;
    }
    const toProcess = files.slice(0, remaining);
    const urls: string[] = [];
    for (const f of toProcess) {
      const dataUrl = await readImageFileAsDataUrl(f, 900);
      urls.push(dataUrl);
    }
    setPImages((prev) => [...prev, ...urls]);
    e.target.value = "";
  }

  function addProductImageUrl() {
    const url = pImageUrlInput.trim();
    if (!url) return;
    const maxAllowed = plan?.maxImagesPerProduct || 5;
    if (pImages.length >= maxAllowed) {
      showToast("err", `الحد الأقصى للصور في باقتك هو ${maxAllowed}`);
      return;
    }
    setPImages((prev) => [...prev, url]);
    setPImageUrlInput("");
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSavingProduct(true);
    try {
      const payload = {
        id: editingProduct?.id,
        name: pName,
        description: pDesc,
        category: pCategory,
        images: pImages,
        originalPrice: Number(pOriginalPrice),
        discountType: pDiscountType,
        discountValue: Number(pDiscountValue),
        stockQuantity: Number(pStock),
        isActive: pActive,
      };
      const res = await fetch("/api/merchant/products", {
        method: editingProduct ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error || "تعذر حفظ المنتج");
        return;
      }
      setProductModalOpen(false);
      showToast("ok", editingProduct ? "تم تحديث المنتج بنجاح" : "تمت إضافة المنتج بنجاح");
      await fetchDashboard();
    } finally {
      setSavingProduct(false);
    }
  }

  async function deleteProduct(id: number) {
    if (!confirm("هل أنت متأكد من حذف هذا المنتج نهائياً؟")) return;
    const prev = products;
    setProducts((p) => p.filter((x) => x.id !== id));
    const res = await fetch(`/api/merchant/products?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setProducts(prev);
      showToast("err", "فشل حذف المنتج");
    } else {
      showToast("ok", "تم حذف المنتج");
    }
  }

  async function updateOrderStatus(orderId: number, status: string) {
    const prev = orders;
    setOrders((o) => o.map((x) => (x.id === orderId ? { ...x, status } : x)));
    const res = await fetch("/api/merchant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "order_status", orderId, status }),
    });
    if (!res.ok) {
      setOrders(prev);
      showToast("err", "تعذر تحديث حالة الطلب");
    } else {
      showToast("ok", "تم تحديث حالة الطلب");
    }
  }

  async function savePaymentSettings() {
    setSavingPayments(true);
    try {
      const res = await fetch("/api/merchant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "payment_methods", methods: paymentMethods }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error || "يرجى إكمال بيانات المحافظ المفعّلة");
        return;
      }
      showToast("ok", "تم حفظ إعدادات طرق الدفع بنجاح");
    } finally {
      setSavingPayments(false);
    }
  }

  async function saveStoreSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingStore(true);
    try {
      const res = await fetch("/api/merchant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: sName,
          slug: sSlug,
          primaryColor: sColor,
          logoUrl: sLogo,
          description: sDesc,
          city: sCity,
          phone: sPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error || "تعذر حفظ إعدادات المتجر");
        return;
      }
      setMerchant(data.merchant);
      showToast("ok", "تم تحديث إعدادات المتجر ورابطه بنجاح");
    } finally {
      setSavingStore(false);
    }
  }

  async function handleSubscriptionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subReceipt) {
      showToast("err", "يرجى رفع صورة إيصال التحويل");
      return;
    }
    setSubmittingSub(true);
    try {
      const res = await fetch("/api/merchant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: subPlanId,
          paymentMethodName: subMethod,
          receiptImageUrl: subReceipt,
          transferNote: subNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error || "فشل إرسال طلب الاشتراك");
        return;
      }
      setSubReceipt("");
      setSubNote("");
      showToast("ok", "تم إرسال إيصال الاشتراك للمراجعة من إدارة المنصة");
      await fetchDashboard();
    } finally {
      setSubmittingSub(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-teal-700 font-bold">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>جاري تحميل لوحة تحكم التاجر...</span>
        </div>
      </div>
    );
  }

  if (!merchant) return null;

  const statusMeta = MERCHANT_STATUS_META[merchant.status] || MERCHANT_STATUS_META.pending;
  const totalSales = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((acc, o) => acc + o.totalAmount, 0);
  const pendingOrdersCount = orders.filter((o) => o.status === "pending").length;

  const NAV_ITEMS: Array<{ id: TabId; label: string; icon: typeof LayoutDashboard }> = [
    { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
    { id: "products", label: "المنتجات", icon: Package },
    { id: "orders", label: "الطلبات الواردة", icon: ShoppingCart },
    { id: "payments", label: "إعدادات الدفع", icon: CreditCard },
    { id: "store", label: "إعدادات المتجر", icon: Settings },
    { id: "subscription", label: "الاشتراك والباقة", icon: Crown },
  ];

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 left-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2 ${
            toast.type === "ok"
              ? "bg-emerald-700 text-white"
              : "bg-rose-700 text-white"
          }`}
        >
          {toast.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-64 bg-white border-l border-stone-200 flex flex-col transition-transform lg:static lg:translate-x-0 ${
          mobileMenu ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-16 px-5 border-b border-stone-200 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl text-white flex items-center justify-center"
              style={{ backgroundColor: merchant.primaryColor }}
            >
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm text-slate-900 truncate max-w-[130px]">
                {merchant.storeName}
              </div>
              <div className="text-[11px] font-mono text-teal-700" dir="ltr">
                /{merchant.slug}
              </div>
            </div>
          </Link>
          <button onClick={() => setMobileMenu(false)} className="lg:hidden text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  setMobileMenu(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold transition ${
                  active
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-slate-600 hover:bg-stone-100"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </span>
                {item.id === "orders" && pendingOrdersCount > 0 && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      active ? "bg-white text-teal-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {pendingOrdersCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-stone-200 space-y-2">
          <Link
            href={`/${merchant.slug}`}
            target="_blank"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-800 text-xs font-bold hover:bg-teal-100 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            معاينة المتجر
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-stone-200 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenu(true)}
              className="lg:hidden p-2 rounded-xl border border-stone-200 text-slate-700"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-extrabold text-lg text-slate-900">
              {NAV_ITEMS.find((n) => n.id === tab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusMeta.badgeClass}`}>
              {statusMeta.label}
            </span>
            {plan && (
              <span className="hidden sm:inline-block text-xs font-bold px-3 py-1 rounded-full bg-stone-100 text-slate-700 border border-stone-200">
                {plan.nameAr}
              </span>
            )}
          </div>
        </header>

        <main className="p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
          {/* Subscription Status Alert Banner */}
          {merchant.status !== "active" && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-amber-900">
                    {merchant.status === "pending"
                      ? "متجرك بانتظار التفعيل من إدارة المنصة"
                      : merchant.status === "expired"
                      ? "انتهى اشتراكك الشهري وتم تعليق رابط المتجر مؤقتاً"
                      : "متجرك معلّق حالياً من قبل الإدارة"}
                  </p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {merchant.status === "suspended"
                      ? "يرجى التواصل مع الدعم الفني للمنصة."
                      : "يمكنك رفع إيصال التحويل من تبويب الاشتراك لتفعيل رابط المتجر فوراً عند الموافقة."}
                  </p>
                </div>
              </div>
              {merchant.status !== "suspended" && (
                <button
                  onClick={() => setTab("subscription")}
                  className="px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-bold hover:bg-amber-800 shrink-0"
                >
                  تجديد / تفعيل الاشتراك
                </button>
              )}
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-6">
              {/* Store URL Card */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-500">رابط متجرك المستقل</div>
                  <div className="text-base sm:text-lg font-mono font-bold text-teal-700 mt-1" dir="ltr">
                    /{merchant.slug}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    تاريخ انتهاء الاشتراك: {formatDateAr(merchant.subscriptionEndsAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/${merchant.slug}`);
                      setCopiedSlug(true);
                      setTimeout(() => setCopiedSlug(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-200 text-xs font-bold text-slate-700 hover:bg-stone-100"
                  >
                    {copiedSlug ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {copiedSlug ? "تم النسخ" : "نسخ الرابط"}
                  </button>
                  <Link
                    href={`/${merchant.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-700 text-white text-xs font-bold hover:bg-teal-800"
                  >
                    <ExternalLink className="w-4 h-4" />
                    فتح المتجر
                  </Link>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-stone-200 p-5">
                  <div className="text-xs font-semibold text-slate-500">المنتجات</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-2">
                    {products.length}
                    <span className="text-sm font-semibold text-slate-400">
                      {" "}
                      / {plan?.maxProducts || 0}
                    </span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-stone-200 p-5">
                  <div className="text-xs font-semibold text-slate-500">إجمالي الطلبات</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-2">{orders.length}</div>
                </div>
                <div className="bg-white rounded-2xl border border-stone-200 p-5">
                  <div className="text-xs font-semibold text-slate-500">طلبات جديدة</div>
                  <div className="text-2xl font-extrabold text-amber-600 mt-2">
                    {pendingOrdersCount}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-stone-200 p-5">
                  <div className="text-xs font-semibold text-slate-500">إجمالي المبيعات</div>
                  <div className="text-2xl font-extrabold text-teal-700 mt-2">
                    {formatYer(totalSales)}
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-base text-slate-900">أحدث الطلبات</h2>
                  <button
                    onClick={() => setTab("orders")}
                    className="text-xs font-bold text-teal-700 hover:underline"
                  >
                    عرض الكل
                  </button>
                </div>
                {orders.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">
                    لا توجد طلبات واردة حتى الآن.
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {orders.slice(0, 5).map((ord) => {
                      const meta = ORDER_STATUS_META[ord.status] || ORDER_STATUS_META.pending;
                      return (
                        <div key={ord.id} className="py-3 flex items-center justify-between gap-4">
                          <div>
                            <div className="font-bold text-sm text-slate-900">
                              #{ord.id} — {ord.customerName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {ord.paymentMethodName} • {formatDateAr(ord.createdAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-sm text-slate-900">
                              {formatYer(ord.totalAmount)}
                            </span>
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${meta.badgeClass}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTS */}
          {tab === "products" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200">
                <div>
                  <div className="font-bold text-slate-900">
                    إدارة المنتجات ({products.length} / {plan?.maxProducts || 0})
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    تسمح باقتك الحالية برفع حتى {plan?.maxImagesPerProduct || 2} صور لكل منتج.
                  </div>
                </div>
                <button
                  onClick={openAddProduct}
                  disabled={products.length >= (plan?.maxProducts || 0)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-bold transition"
                >
                  <Plus className="w-4 h-4" />
                  إضافة منتج جديد
                </button>
              </div>

              {products.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-3">
                  <Package className="w-12 h-12 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700">متجرك لا يحتوي على منتجات بعد</p>
                  <button
                    onClick={openAddProduct}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 text-white text-sm font-bold"
                  >
                    <Plus className="w-4 h-4" />
                    أضف أول منتج
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((p) => {
                    const hasDiscount = p.finalPrice < p.originalPrice;
                    return (
                      <div
                        key={p.id}
                        className="bg-white rounded-2xl border border-stone-200 overflow-hidden flex flex-col justify-between shadow-sm"
                      >
                        <div>
                          <div className="h-44 bg-stone-100 relative overflow-hidden">
                            {p.images?.[0] ? (
                              <img
                                src={p.images[0]}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <ImageIcon className="w-8 h-8" />
                              </div>
                            )}
                            <span className="absolute top-2.5 right-2.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/90 text-slate-800 shadow-sm">
                              {p.category}
                            </span>
                            <span className="absolute bottom-2.5 left-2.5 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-900/75 text-white">
                              {p.images?.length || 0} صور
                            </span>
                          </div>
                          <div className="p-4 space-y-2">
                            <h3 className="font-bold text-slate-900 line-clamp-1">{p.name}</h3>
                            <div className="flex items-baseline gap-2">
                              <span className="font-extrabold text-base text-teal-700">
                                {formatYer(p.finalPrice)}
                              </span>
                              {hasDiscount && (
                                <span className="text-xs text-slate-400 line-through">
                                  {formatYer(p.originalPrice)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>المخزون: {p.stockQuantity}</span>
                              <span className={p.isActive ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
                                {p.isActive ? "ظاهر بالمتجر" : "مخفي"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="px-4 py-3 border-t border-stone-100 flex items-center gap-2">
                          <button
                            onClick={() => openEditProduct(p)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-stone-200 text-xs font-bold text-slate-700 hover:bg-stone-100"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            تعديل
                          </button>
                          <button
                            onClick={() => deleteProduct(p.id)}
                            className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ORDERS */}
          {tab === "orders" && (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                  <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">لا توجد طلبات واردة بعد</p>
                </div>
              ) : (
                orders.map((ord) => {
                  const meta = ORDER_STATUS_META[ord.status] || ORDER_STATUS_META.pending;
                  return (
                    <div
                      key={ord.id}
                      className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900">طلب #{ord.id}</span>
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${meta.badgeClass}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {formatDateAr(ord.createdAt)} • الدفع: <strong>{ord.paymentMethodName}</strong>
                            {ord.paymentReference && ` • مرجع: ${ord.paymentReference}`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={ord.status}
                            onChange={(e) => updateOrderStatus(ord.id, e.target.value)}
                            className="px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold bg-white"
                          >
                            <option value="pending">جديد</option>
                            <option value="confirmed">مؤكد</option>
                            <option value="shipped">قيد التوصيل</option>
                            <option value="delivered">تم التسليم</option>
                            <option value="cancelled">ملغي</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3 text-xs bg-stone-50 rounded-xl p-3.5">
                        <div>
                          <span className="text-slate-500">العميل: </span>
                          <strong className="text-slate-900">{ord.customerName}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">الهاتف: </span>
                          <strong className="text-slate-900 font-mono" dir="ltr">
                            {ord.customerPhone}
                          </strong>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-slate-500">العنوان: </span>
                          <strong className="text-slate-900">{ord.customerAddress}</strong>
                        </div>
                        {ord.notes && (
                          <div className="sm:col-span-2 text-amber-800">
                            ملاحظات: {ord.notes}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {ord.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2.5">
                              {item.productImage && (
                                <img
                                  src={item.productImage}
                                  alt={item.productName}
                                  className="w-9 h-9 rounded-lg object-cover border border-stone-200"
                                />
                              )}
                              <span>
                                {item.productName}{" "}
                                <strong className="text-slate-500">× {item.quantity}</strong>
                              </span>
                            </div>
                            <span className="font-bold">{formatYer(item.subtotal)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-stone-100 pt-3 flex items-center justify-between font-extrabold text-base">
                        <span>المجموع الكلي</span>
                        <span className="text-teal-700">{formatYer(ord.totalAmount)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: PAYMENT SETTINGS (Yemen Methods) */}
          {tab === "payments" && (
            <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
              <div>
                <h2 className="font-extrabold text-lg text-slate-900">
                  إعدادات طرق استلام الدفع من عملائك
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  فعّل فقط الطرق التي تملك حسابات بها أو تناسب متجرك. الطرق المُفعّلة هنا فقط هي التي
                  ستظهر للعملاء عند الشراء من متجرك، وتصل مبالغ المبيعات مباشرة إلى حساباتك.
                </p>
              </div>

              <div className="space-y-4">
                {paymentMethods.map((pm, idx) => (
                  <div
                    key={pm.platformMethodId}
                    className={`rounded-2xl border p-4 transition ${
                      pm.enabled ? "border-teal-500 bg-teal-50/30" : "border-stone-200 bg-stone-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-bold text-slate-900">{pm.nameAr}</div>
                        <div className="text-xs text-slate-500">
                          {pm.type === "cod"
                            ? "يدفع العميل نقداً عند استلام الطلب — لا يتطلب إدخال بيانات حساب"
                            : pm.type === "bank"
                            ? "تحويل بنكي لحسابك التجاري"
                            : "محفظة إلكترونية يمنية"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setPaymentMethods((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, enabled: !row.enabled } : row
                            )
                          )
                        }
                        className={`relative inline-flex h-7 w-13 items-center rounded-full transition ${
                          pm.enabled ? "bg-teal-700" : "bg-stone-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            pm.enabled ? "-translate-x-7" : "-translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    {pm.enabled && pm.type !== "cod" && (
                      <div className="mt-4 pt-4 border-t border-stone-200 grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            اسم صاحب المحفظة / الحساب (كما هو مسجل) *
                          </label>
                          <input
                            type="text"
                            value={pm.accountHolderName}
                            onChange={(e) =>
                              setPaymentMethods((prev) =>
                                prev.map((row, i) =>
                                  i === idx ? { ...row, accountHolderName: e.target.value } : row
                                )
                              )
                            }
                            placeholder="الاسم الثلاثي أو اسم المتجر"
                            className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            رقم المحفظة أو رقم الحساب *
                          </label>
                          <input
                            type="text"
                            dir="ltr"
                            value={pm.accountNumber}
                            onChange={(e) =>
                              setPaymentMethods((prev) =>
                                prev.map((row, i) =>
                                  i === idx ? { ...row, accountNumber: e.target.value } : row
                                )
                              )
                            }
                            placeholder="77XXXXXXX / رقم الحساب"
                            className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm font-mono"
                          />
                        </div>
                        {pm.type === "bank" && (
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              اسم البنك (اختياري)
                            </label>
                            <input
                              type="text"
                              value={pm.bankName}
                              onChange={(e) =>
                                setPaymentMethods((prev) =>
                                  prev.map((row, i) =>
                                    i === idx ? { ...row, bankName: e.target.value } : row
                                  )
                                )
                              }
                              placeholder="مثال: بنك الكريمي / بنك التضامن / بنك اليمن والكويت"
                              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={savePaymentSettings}
                  disabled={savingPayments}
                  className="px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold text-sm transition"
                >
                  {savingPayments ? "جاري الحفظ..." : "حفظ إعدادات الدفع"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: STORE SETTINGS */}
          {tab === "store" && (
            <form
              onSubmit={saveStoreSettings}
              className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5"
            >
              <h2 className="font-extrabold text-lg text-slate-900">
                تخصيص المتجر والرابط المستقل
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    اسم المتجر
                  </label>
                  <input
                    type="text"
                    required
                    value={sName}
                    onChange={(e) => setSName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    المدينة / المحافظة
                  </label>
                  <input
                    type="text"
                    value={sCity}
                    onChange={(e) => setSCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  رابط المتجر (Slug)
                </label>
                <div className="flex items-center border border-stone-300 rounded-xl overflow-hidden" dir="ltr">
                  <span className="bg-stone-100 px-3 py-2.5 text-xs font-mono text-slate-500 border-r border-stone-300">
                    matajeruna.com/
                  </span>
                  <input
                    type="text"
                    required
                    value={sSlug}
                    onChange={(e) => setSSlug(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-sm font-mono focus:outline-none"
                  />
                </div>
                <div className="mt-1.5 min-h-[18px] text-xs">
                  {slugCheck.checking && <span className="text-slate-500">جاري التحقق...</span>}
                  {!slugCheck.checking && slugCheck.available === true && (
                    <span className="text-emerald-700 font-bold">الرابط متاح للاستخدام ✓</span>
                  )}
                  {!slugCheck.checking && slugCheck.available === false && (
                    <span className="text-rose-600 font-bold">{slugCheck.reason}</span>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    رقم التواصل للعملاء
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={sPhone}
                    onChange={(e) => setSPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    اللون الأساسي للمتجر
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={sColor}
                      onChange={(e) => setSColor(e.target.value)}
                      className="h-10 w-12 rounded-lg border border-stone-300 p-0.5 cursor-pointer"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSColor(c)}
                          className={`w-6 h-6 rounded-full border-2 ${
                            sColor === c ? "border-slate-900 scale-110" : "border-white"
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  شعار المتجر (Logo)
                </label>
                <div className="flex items-center gap-4">
                  {sLogo && (
                    <img
                      src={sLogo}
                      alt="logo"
                      className="w-14 h-14 rounded-xl object-cover border border-stone-200"
                    />
                  )}
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 bg-stone-50 text-xs font-bold text-slate-700 cursor-pointer hover:bg-stone-100">
                    <Upload className="w-4 h-4" />
                    رفع صورة الشعار
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) setSLogo(await readImageFileAsDataUrl(f, 500));
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  وصف المتجر
                </label>
                <textarea
                  rows={3}
                  value={sDesc}
                  onChange={(e) => setSDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingStore || slugCheck.available === false}
                  className="px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold text-sm"
                >
                  {savingStore ? "جاري الحفظ..." : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 6: SUBSCRIPTION & BILLING */}
          {tab === "subscription" && (
            <div className="space-y-6">
              {/* Current Plan Summary */}
              {plan && (
                <div className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-teal-700">باقتك الحالية</div>
                    <h2 className="text-xl font-extrabold text-slate-900 mt-1">
                      {plan.nameAr} — {formatYer(plan.priceYer)} / شهرياً
                    </h2>
                    <div className="text-xs text-slate-600 mt-2 flex flex-wrap gap-3">
                      <span>الحد الأقصى للمنتجات: {plan.maxProducts}</span>
                      <span>• صور لكل منتج: {plan.maxImagesPerProduct}</span>
                      <span>• {plan.supportLevel}</span>
                    </div>
                  </div>
                  <div className="text-right sm:text-left">
                    <div className="text-xs text-slate-500">ينتهي الاشتراك في</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {formatDateAr(merchant.subscriptionEndsAt)}
                    </div>
                  </div>
                </div>
              )}

              {/* Renewal / Upgrade Form */}
              <form
                onSubmit={handleSubscriptionSubmit}
                className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5"
              >
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900">
                    تجديد الاشتراك أو ترقية الباقة
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {wallets?.instructions ||
                      "حوّل رسوم الباقة إلى محفظة المنصة التالية ثم ارفع صورة الإيصال ليقوم السوبر أدمن بالمراجعة والتفعيل."}
                  </p>
                </div>

                {wallets?.accounts && (
                  <div className="grid sm:grid-cols-3 gap-3">
                    {wallets.accounts.map((acc, i) => (
                      <div key={i} className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs">
                        <div className="font-bold text-slate-900">{acc.method}</div>
                        <div className="text-slate-600 mt-0.5">{acc.accountName}</div>
                        <div className="font-mono font-bold text-teal-700 mt-1" dir="ltr">
                          {acc.accountNumber}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid sm:grid-cols-3 gap-3">
                  {allPlans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSubPlanId(p.id)}
                      className={`p-3.5 rounded-xl border text-right transition ${
                        subPlanId === p.id
                          ? "border-teal-600 bg-teal-50/70 ring-1 ring-teal-600"
                          : "border-stone-200"
                      }`}
                    >
                      <div className="font-bold text-sm">{p.nameAr}</div>
                      <div className="font-extrabold text-teal-700 mt-1">{formatYer(p.priceYer)}</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {p.maxProducts} منتج • {p.maxImagesPerProduct} صور
                      </div>
                    </button>
                  ))}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      طريقة التحويل المستخدمة
                    </label>
                    <select
                      value={subMethod}
                      onChange={(e) => setSubMethod(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm bg-white"
                    >
                      <option value="جوالي (Jawali)">جوالي (Jawali)</option>
                      <option value="جيب (Jaib)">جيب (Jaib)</option>
                      <option value="بنك الكريمي">بنك الكريمي</option>
                      <option value="محفظتي">محفظتي</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      صورة إيصال التحويل *
                    </label>
                    <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-teal-400 bg-teal-50/30 text-xs font-bold text-teal-700 cursor-pointer hover:bg-teal-50">
                      <Upload className="w-4 h-4" />
                      <span>{subReceipt ? "تم اختيار الإيصال ✓" : "رفع صورة الإيصال"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) setSubReceipt(await readImageFileAsDataUrl(f, 900));
                        }}
                      />
                    </label>
                  </div>
                </div>

                <input
                  type="text"
                  value={subNote}
                  onChange={(e) => setSubNote(e.target.value)}
                  placeholder="رقم الحوالة أو ملاحظة إضافية (اختياري)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm"
                />

                <button
                  type="submit"
                  disabled={submittingSub}
                  className="px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold text-sm"
                >
                  {submittingSub ? "جاري الإرسال..." : "إرسال طلب التفعيل / التجديد"}
                </button>
              </form>

              {/* Requests History */}
              <div className="bg-white rounded-2xl border border-stone-200 p-6">
                <h3 className="font-bold text-base text-slate-900 mb-4">سجل طلبات الاشتراك</h3>
                {subRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">لا توجد طلبات اشتراك سابقة.</p>
                ) : (
                  <div className="space-y-3">
                    {subRequests.map((req) => (
                      <div
                        key={req.id}
                        className="border border-stone-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={req.receiptImageUrl}
                            alt="receipt"
                            className="w-12 h-12 rounded-lg object-cover border border-stone-200"
                          />
                          <div>
                            <div className="font-bold text-sm text-slate-900">
                              {req.planNameAr} — {formatYer(req.amountYer)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {req.paymentMethodName} • {formatDateAr(req.createdAt)}
                            </div>
                            {req.adminNote && (
                              <div className="text-xs text-slate-600 mt-0.5">
                                ملاحظة الإدارة: {req.adminNote}
                              </div>
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full self-start sm:self-center ${
                            req.status === "approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : req.status === "rejected"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {req.status === "approved"
                            ? "مقبول ومفعّل"
                            : req.status === "rejected"
                            ? "مرفوض"
                            : "بانتظار المراجعة"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add/Edit Product Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="font-extrabold text-lg">
                {editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}
              </h3>
              <button onClick={() => setProductModalOpen(false)} className="text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveProduct} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم المنتج *</label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف *</label>
                  <input
                    type="text"
                    required
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وصف المنتج</label>
                <textarea
                  rows={2}
                  value={pDesc}
                  onChange={(e) => setPDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                />
              </div>

              {/* Multiple Images Uploader */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  صور المنتج ({pImages.length} / {plan?.maxImagesPerProduct || 2}) — يدعم jpg, png, webp, gif
                </label>
                <div className="flex flex-wrap gap-2">
                  {pImages.map((img, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-stone-200">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {pImages.length < (plan?.maxImagesPerProduct || 2) && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-teal-400 flex flex-col items-center justify-center text-teal-700 cursor-pointer hover:bg-teal-50 text-[10px] font-bold">
                      <Upload className="w-4 h-4 mb-0.5" />
                      رفع صور
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        onChange={handleProductImagesUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    dir="ltr"
                    value={pImageUrlInput}
                    onChange={(e) => setPImageUrlInput(e.target.value)}
                    placeholder="أو الصق رابط صورة مباشر https://..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-stone-300 text-xs"
                  />
                  <button
                    type="button"
                    onClick={addProductImageUrl}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 text-xs font-bold text-slate-700 hover:bg-stone-200"
                  >
                    إضافة
                  </button>
                </div>
              </div>

              {/* Pricing & Discount */}
              <div className="bg-stone-50 rounded-xl p-3.5 space-y-3 border border-stone-200">
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      السعر الأصلي (ريال)
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={pOriginalPrice}
                      onChange={(e) => setPOriginalPrice(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نوع الخصم</label>
                    <select
                      value={pDiscountType}
                      onChange={(e) =>
                        setPDiscountType(e.target.value as "none" | "percentage" | "fixed")
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-stone-300 bg-white text-sm"
                    >
                      <option value="none">بدون خصم</option>
                      <option value="percentage">نسبة (%)</option>
                      <option value="fixed">مبلغ ثابت (ريال)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">قيمة الخصم</label>
                    <input
                      type="number"
                      min={0}
                      disabled={pDiscountType === "none"}
                      value={pDiscountValue}
                      onChange={(e) => setPDiscountValue(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl border border-stone-300 bg-white text-sm disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm pt-1">
                  <span className="text-slate-600 font-semibold">السعر النهائي للعميل:</span>
                  <div className="flex items-baseline gap-2">
                    {computedPreviewFinalPrice < Number(pOriginalPrice) && (
                      <span className="text-xs text-slate-400 line-through">
                        {formatYer(Number(pOriginalPrice))}
                      </span>
                    )}
                    <span className="font-extrabold text-teal-700">
                      {formatYer(computedPreviewFinalPrice)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الكمية المتوفرة بالمخزون
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={pStock}
                    onChange={(e) => setPStock(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 pt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pActive}
                    onChange={(e) => setPActive(e.target.checked)}
                    className="rounded text-teal-700"
                  />
                  عرض المنتج في المتجر
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-bold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold"
                >
                  {savingProduct ? "جاري الحفظ..." : "حفظ المنتج"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
