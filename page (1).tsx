"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  BarChart3,
  Users,
  Receipt,
  Layers,
  CreditCard,
  LogOut,
  Search,
  Eye,
  PauseCircle,
  PlayCircle,
  Pencil,
  KeyRound,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  ExternalLink,
  X,
  Menu,
  Loader2,
  TrendingUp,
} from "lucide-react";
import {
  formatDateAr,
  formatYer,
  MERCHANT_STATUS_META,
  ORDER_STATUS_META,
} from "@/lib/client-utils";

type AdminTab = "overview" | "merchants" | "subscriptions" | "plans" | "payments";

interface AdminMerchant {
  id: number;
  userId: number;
  planId: number;
  storeName: string;
  slug: string;
  city: string | null;
  phone: string | null;
  status: "active" | "pending" | "suspended" | "expired";
  subscriptionEndsAt: string | null;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  planNameAr: string;
  productsCount: number;
  ordersCount: number;
  salesTotal: number;
}

interface SubRequest {
  id: number;
  merchantId: number;
  storeName: string;
  storeSlug: string;
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
  isActive: boolean;
}

interface PlatformPaymentMethod {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  type: "wallet" | "bank" | "cod";
  isActive: boolean;
}

interface MerchantDeepDetails {
  merchant: AdminMerchant;
  products: Array<{ id: number; name: string; finalPrice: number; stockQuantity: number; category: string }>;
  orders: Array<{ id: number; customerName: string; totalAmount: number; status: string; createdAt: string }>;
  paymentMethods: Array<{
    id: number;
    nameAr: string;
    enabled: boolean;
    accountHolderName: string | null;
    accountNumber: string | null;
  }>;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [stats, setStats] = useState<{
    totalMerchants: number;
    activeMerchants: number;
    suspendedMerchants: number;
    expiredMerchants: number;
    pendingMerchants: number;
    pendingRequests: number;
    totalSubscriptionRevenue: number;
    expiringSoon: AdminMerchant[];
    topMerchants: AdminMerchant[];
  } | null>(null);
  const [merchants, setMerchants] = useState<AdminMerchant[]>([]);
  const [subRequests, setSubRequests] = useState<SubRequest[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PlatformPaymentMethod[]>([]);

  // Filters for Merchants
  const [searchQ, setSearchQ] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");

  // Modals
  const [detailsModal, setDetailsModal] = useState<MerchantDeepDetails | null>(null);
  const [editMerchantModal, setEditMerchantModal] = useState<AdminMerchant | null>(null);
  const [editPlanId, setEditPlanId] = useState(0);
  const [editStatus, setEditStatus] = useState("active");
  const [editExtendDays, setEditExtendDays] = useState("0");
  const [editStoreName, setEditStoreName] = useState("");

  const [resetPwMerchant, setResetPwMerchant] = useState<AdminMerchant | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [reviewNoteMap, setReviewNoteMap] = useState<Record<number, string>>({});

  // Plan Modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [plNameAr, setPlNameAr] = useState("");
  const [plNameEn, setPlNameEn] = useState("");
  const [plPrice, setPlPrice] = useState("10000");
  const [plMaxProds, setPlMaxProds] = useState("30");
  const [plMaxImgs, setPlMaxImgs] = useState("4");
  const [plReports, setPlReports] = useState(true);
  const [plSupport, setPlSupport] = useState("دعم فني أولوية");
  const [plDesc, setPlDesc] = useState("");

  // New Payment Method Form
  const [pmNameAr, setPmNameAr] = useState("");
  const [pmNameEn, setPmNameEn] = useState("");
  const [pmType, setPmType] = useState<"wallet" | "bank" | "cod">("wallet");

  const showToast = useCallback((type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchAdminData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin");
      if (res.status === 403 || res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setStats(data.stats);
      setMerchants(data.merchants || []);
      setSubRequests(data.subscriptionRequests || []);
      setPlans(data.plans || []);
      setPaymentMethods(data.paymentMethods || []);
    } catch {
      showToast("err", "تعذر تحميل بيانات لوحة الأدمن");
    } finally {
      setLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const filteredMerchants = useMemo(() => {
    return merchants.filter((m) => {
      if (filterPlan !== "all" && String(m.planId) !== filterPlan) return false;
      if (filterStatus !== "all" && m.status !== filterStatus) return false;
      if (filterDateFrom && new Date(m.createdAt) < new Date(filterDateFrom)) return false;
      if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        const hit =
          m.storeName.toLowerCase().includes(q) ||
          m.slug.toLowerCase().includes(q) ||
          m.ownerName.toLowerCase().includes(q) ||
          m.ownerEmail.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [merchants, filterPlan, filterStatus, filterDateFrom, searchQ]);

  async function handleLogout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.push("/login");
  }

  async function openMerchantDetails(merchantId: number) {
    const res = await fetch(`/api/admin?merchantId=${merchantId}`);
    if (res.ok) {
      setDetailsModal(await res.json());
    }
  }

  async function toggleSuspendMerchant(m: AdminMerchant) {
    const nextStatus = m.status === "suspended" ? "active" : "suspended";
    const prev = merchants;
    setMerchants((list) =>
      list.map((item) => (item.id === m.id ? { ...item, status: nextStatus } : item))
    );
    const res = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId: m.id, status: nextStatus }),
    });
    if (!res.ok) {
      setMerchants(prev);
      showToast("err", "فشل تغيير حالة التاجر");
    } else {
      showToast("ok", nextStatus === "suspended" ? "تم تعليق المتجر مؤقتاً" : "تم تفعيل المتجر");
      fetchAdminData();
    }
  }

  async function saveManualMerchantEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editMerchantModal) return;
    const res = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantId: editMerchantModal.id,
        planId: editPlanId,
        status: editStatus,
        extendDays: Number(editExtendDays) || 0,
        storeName: editStoreName,
      }),
    });
    if (res.ok) {
      setEditMerchantModal(null);
      showToast("ok", "تم تعديل بيانات التاجر بنجاح");
      fetchAdminData();
    } else {
      showToast("err", "تعذر التعديل");
    }
  }

  async function submitResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetPwMerchant) return;
    const res = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantId: resetPwMerchant.id,
        action: "reset_password",
        newPassword,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setResetPwMerchant(null);
      setNewPassword("");
      showToast("ok", "تمت إعادة تعيين كلمة المرور بنجاح");
    } else {
      showToast("err", data.error || "تعذر تغيير كلمة المرور");
    }
  }

  async function deleteMerchantPermanently(m: AdminMerchant) {
    if (!confirm(`تحذير: سيتم حذف التاجر "${m.storeName}" وكل منتجاته وطلباته نهائياً. هل أنت متأكد؟`)) {
      return;
    }
    const res = await fetch(`/api/admin?merchantId=${m.id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("ok", "تم حذف التاجر نهائياً من المنصة");
      fetchAdminData();
    } else {
      showToast("err", "فشل حذف التاجر");
    }
  }

  async function reviewSubscription(requestId: number, decision: "approved" | "rejected") {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review_subscription",
        requestId,
        decision,
        adminNote: reviewNoteMap[requestId] || "",
      }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(
        "ok",
        decision === "approved"
          ? "تمت الموافقة وتفعيل اشتراك التاجر ورابط متجره تلقائياً"
          : "تم رفض طلب الاشتراك"
      );
      fetchAdminData();
    } else {
      showToast("err", data.error || "تعذر تنفيذ المراجعة");
    }
  }

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_plan",
        id: editingPlan?.id,
        nameAr: plNameAr,
        nameEn: plNameEn,
        priceYer: Number(plPrice),
        maxProducts: Number(plMaxProds),
        maxImagesPerProduct: Number(plMaxImgs),
        reportsEnabled: plReports,
        supportLevel: plSupport,
        descriptionAr: plDesc,
      }),
    });
    if (res.ok) {
      setPlanModalOpen(false);
      showToast("ok", "تم حفظ الباقة بنجاح");
      fetchAdminData();
    } else {
      const data = await res.json();
      showToast("err", data.error || "فشل حفظ الباقة");
    }
  }

  async function deletePlan(id: number) {
    if (!confirm("هل تريد حذف هذه الباقة؟")) return;
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_plan", id }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("ok", "تم حذف الباقة");
      fetchAdminData();
    } else {
      showToast("err", data.error || "تعذر الحذف");
    }
  }

  async function togglePlatformPayment(pm: PlatformPaymentMethod) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_payment_method",
        id: pm.id,
        isActive: !pm.isActive,
      }),
    });
    if (res.ok) {
      showToast("ok", !pm.isActive ? `تم تفعيل "${pm.nameAr}" على مستوى المنصة` : `تم تعطيل "${pm.nameAr}" على مستوى المنصة`);
      fetchAdminData();
    }
  }

  async function createPlatformPayment(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_payment_method",
        nameAr: pmNameAr,
        nameEn: pmNameEn,
        type: pmType,
      }),
    });
    if (res.ok) {
      setPmNameAr("");
      setPmNameEn("");
      showToast("ok", "تمت إضافة طريقة الدفع الجديدة للمنصة");
      fetchAdminData();
    } else {
      const data = await res.json();
      showToast("err", data.error || "تعذر الإضافة");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <Loader2 className="w-6 h-6 animate-spin text-teal-700" />
          <span>جاري تحميل لوحة التحكم المركزية...</span>
        </div>
      </div>
    );
  }

  const NAV: Array<{ id: AdminTab; label: string; icon: typeof BarChart3; badge?: number }> = [
    { id: "overview", label: "الإحصائيات والتنبيهات", icon: BarChart3 },
    { id: "merchants", label: "إدارة التجار", icon: Users, badge: stats?.totalMerchants },
    {
      id: "subscriptions",
      label: "طلبات الاشتراك والدفع",
      icon: Receipt,
      badge: stats?.pendingRequests || undefined,
    },
    { id: "plans", label: "إدارة الباقات", icon: Layers },
    { id: "payments", label: "طرق الدفع العامة", icon: CreditCard },
  ];

  const pendingSubRequests = subRequests.filter((r) => r.status === "pending");

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {toast && (
        <div
          className={`fixed bottom-5 left-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2 ${
            toast.type === "ok" ? "bg-emerald-700 text-white" : "bg-rose-700 text-white"
          }`}
        >
          {toast.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-64 bg-slate-900 text-white flex flex-col transition-transform lg:static lg:translate-x-0 ${
          mobileMenu ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500 text-white flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm">متاجرنا — الأدمن</div>
              <div className="text-[11px] text-teal-400 font-semibold">Super Admin</div>
            </div>
          </Link>
          <button onClick={() => setMobileMenu(false)} className="lg:hidden text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
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
                  active ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      item.id === "subscriptions"
                        ? "bg-amber-400 text-slate-900"
                        : "bg-slate-700 text-slate-200"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            واجهة المنصة
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-950/50"
          >
            <LogOut className="w-3.5 h-3.5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-stone-200 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenu(true)}
              className="lg:hidden p-2 rounded-xl border border-stone-200"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-extrabold text-lg text-slate-900">
              {NAV.find((n) => n.id === tab)?.label}
            </h1>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
            تحكم مركزي كامل
          </span>
        </header>

        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1: OVERVIEW & ANALYTICS */}
          {tab === "overview" && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-stone-200 p-5">
                  <div className="text-xs font-semibold text-slate-500">إجمالي التجار</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-2">
                    {stats.totalMerchants}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    نشط: {stats.activeMerchants} • معلّق: {stats.suspendedMerchants} • منتهي:{" "}
                    {stats.expiredMerchants}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-stone-200 p-5">
                  <div className="text-xs font-semibold text-slate-500">إيرادات الاشتراكات</div>
                  <div className="text-2xl font-extrabold text-teal-700 mt-2">
                    {formatYer(stats.totalSubscriptionRevenue)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">من الاشتراكات المعتمدة</div>
                </div>
                <div className="bg-white rounded-2xl border border-stone-200 p-5">
                  <div className="text-xs font-semibold text-slate-500">طلبات بانتظار المراجعة</div>
                  <div className="text-2xl font-extrabold text-amber-600 mt-2">
                    {stats.pendingRequests}
                  </div>
                  <button
                    onClick={() => setTab("subscriptions")}
                    className="text-[11px] font-bold text-teal-700 hover:underline mt-1"
                  >
                    مراجعة الإيصالات ←
                  </button>
                </div>
                <div className="bg-white rounded-2xl border border-stone-200 p-5">
                  <div className="text-xs font-semibold text-slate-500">تجار بانتظار التفعيل</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-2">
                    {stats.pendingMerchants}
                  </div>
                </div>
              </div>

              {/* Expiring Soon Alerts */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
                <div className="flex items-center gap-2 font-extrabold text-base text-slate-900">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span>تنبيهات الاشتراكات القريبة من الانتهاء (خلال 7 أيام)</span>
                </div>
                {stats.expiringSoon.length === 0 ? (
                  <p className="text-sm text-slate-500">لا توجد اشتراكات قريبة من الانتهاء حالياً.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {stats.expiringSoon.map((m) => (
                      <div
                        key={m.id}
                        className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-sm text-amber-950">{m.storeName}</div>
                          <div className="text-xs text-amber-800">
                            ينتهي في: {formatDateAr(m.subscriptionEndsAt)} • {m.planNameAr}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setEditMerchantModal(m);
                            setEditPlanId(m.planId);
                            setEditStatus(m.status);
                            setEditExtendDays("30");
                            setEditStoreName(m.storeName);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-bold shrink-0"
                        >
                          تمديد
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Most Active Merchants */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
                <div className="flex items-center gap-2 font-extrabold text-base text-slate-900">
                  <TrendingUp className="w-5 h-5 text-teal-700" />
                  <span>أكثر التجار نشاطاً</span>
                </div>
                <div className="divide-y divide-stone-100">
                  {stats.topMerchants.map((m) => (
                    <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-bold text-sm text-slate-900">
                          {m.storeName}{" "}
                          <span className="text-xs font-mono text-teal-700" dir="ltr">
                            /{m.slug}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">{m.ownerName} • {m.planNameAr}</div>
                      </div>
                      <div className="text-left text-xs space-y-0.5">
                        <div className="font-bold text-slate-800">
                          {m.ordersCount} طلب • {m.productsCount} منتج
                        </div>
                        <div className="text-teal-700 font-bold">{formatYer(m.salesTotal)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MERCHANTS MANAGEMENT */}
          {tab === "merchants" && (
            <div className="space-y-4">
              {/* Search & Filters */}
              <div className="bg-white rounded-2xl border border-stone-200 p-4 grid sm:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="بحث باسم المتجر، الرابط، البريد..."
                    className="w-full pr-9 pl-3 py-2 rounded-xl border border-stone-300 text-sm"
                  />
                </div>
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                >
                  <option value="all">كل الباقات</option>
                  {plans.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.nameAr}
                    </option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                >
                  <option value="all">كل الحالات</option>
                  <option value="active">نشط</option>
                  <option value="pending">بانتظار التفعيل</option>
                  <option value="suspended">معلّق</option>
                  <option value="expired">منتهي الاشتراك</option>
                </select>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  title="تاريخ التسجيل من"
                  className="px-3 py-2 rounded-xl border border-stone-300 text-sm"
                />
              </div>

              {/* Merchants List */}
              <div className="space-y-3">
                {filteredMerchants.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-slate-500">
                    لا يوجد تجار يطابقون معايير البحث.
                  </div>
                ) : (
                  filteredMerchants.map((m) => {
                    const meta = MERCHANT_STATUS_META[m.status] || MERCHANT_STATUS_META.pending;
                    return (
                      <div
                        key={m.id}
                        className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-base text-slate-900">
                              {m.storeName}
                            </span>
                            <Link
                              href={`/${m.slug}`}
                              target="_blank"
                              dir="ltr"
                              className="text-xs font-mono text-teal-700 hover:underline"
                            >
                              /{m.slug}
                            </Link>
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${meta.badgeClass}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                            <span>المالك: {m.ownerName} ({m.ownerEmail})</span>
                            <span>الباقة: <strong>{m.planNameAr}</strong></span>
                            <span>التسجيل: {formatDateAr(m.createdAt)}</span>
                            <span>الانتهاء: {formatDateAr(m.subscriptionEndsAt)}</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            المنتجات: {m.productsCount} • الطلبات: {m.ordersCount} • المبيعات:{" "}
                            {formatYer(m.salesTotal)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => openMerchantDetails(m.id)}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold text-slate-700 hover:bg-stone-100"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            التفاصيل
                          </button>
                          <button
                            onClick={() => {
                              setEditMerchantModal(m);
                              setEditPlanId(m.planId);
                              setEditStatus(m.status);
                              setEditExtendDays("0");
                              setEditStoreName(m.storeName);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold text-slate-700 hover:bg-stone-100"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            تعديل يدوي
                          </button>
                          <button
                            onClick={() => toggleSuspendMerchant(m)}
                            className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border ${
                              m.status === "suspended"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            }`}
                          >
                            {m.status === "suspended" ? (
                              <>
                                <PlayCircle className="w-3.5 h-3.5" />
                                تفعيل
                              </>
                            ) : (
                              <>
                                <PauseCircle className="w-3.5 h-3.5" />
                                تعليق فوري
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setResetPwMerchant(m);
                              setNewPassword("");
                            }}
                            title="إعادة تعيين كلمة المرور"
                            className="p-2 rounded-xl border border-stone-200 text-slate-600 hover:bg-stone-100"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteMerchantPermanently(m)}
                            title="حذف نهائي"
                            className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SUBSCRIPTION REQUESTS & PAYMENT LOG */}
          {tab === "subscriptions" && (
            <div className="space-y-6">
              {/* Pending Queue */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
                <h2 className="font-extrabold text-base text-slate-900">
                  طلبات الاشتراك بانتظار المراجعة ({pendingSubRequests.length})
                </h2>
                {pendingSubRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">لا توجد إيصالات بانتظار المراجعة حالياً.</p>
                ) : (
                  <div className="space-y-4">
                    {pendingSubRequests.map((req) => (
                      <div
                        key={req.id}
                        className="border border-amber-200 bg-amber-50/40 rounded-2xl p-4 flex flex-col md:flex-row justify-between gap-4"
                      >
                        <div className="flex items-start gap-4">
                          <button
                            type="button"
                            onClick={() => setPreviewImage(req.receiptImageUrl)}
                            className="w-20 h-20 rounded-xl overflow-hidden border border-stone-300 shrink-0 hover:opacity-85"
                          >
                            <img
                              src={req.receiptImageUrl}
                              alt="إيصال"
                              className="w-full h-full object-cover"
                            />
                          </button>
                          <div className="space-y-1">
                            <div className="font-extrabold text-slate-900">
                              {req.storeName}{" "}
                              <span className="text-xs font-mono text-teal-700" dir="ltr">
                                /{req.storeSlug}
                              </span>
                            </div>
                            <div className="text-xs text-slate-700">
                              الباقة: <strong>{req.planNameAr}</strong> • المبلغ:{" "}
                              <strong className="text-teal-700">{formatYer(req.amountYer)}</strong> •
                              الطريقة: {req.paymentMethodName}
                            </div>
                            {req.transferNote && (
                              <div className="text-xs text-slate-600">ملاحظة التاجر: {req.transferNote}</div>
                            )}
                            <div className="text-[11px] text-slate-400">
                              تاريخ الرفع: {formatDateAr(req.createdAt)} (اضغط على صورة الإيصال للتكبير)
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 min-w-[220px]">
                          <input
                            type="text"
                            placeholder="ملاحظة الإدارة (اختياري)"
                            value={reviewNoteMap[req.id] || ""}
                            onChange={(e) =>
                              setReviewNoteMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                            }
                            className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => reviewSubscription(req.id, "approved")}
                              className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                            >
                              موافقة وتفعيل
                            </button>
                            <button
                              onClick={() => reviewSubscription(req.id, "rejected")}
                              className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                            >
                              رفض
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Full Payment History */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
                <h2 className="font-extrabold text-base text-slate-900">
                  السجل الكامل لمدفوعات واشتراكات التجار
                </h2>
                <div className="divide-y divide-stone-100">
                  {subRequests.map((req) => (
                    <div key={req.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setPreviewImage(req.receiptImageUrl)}>
                          <img
                            src={req.receiptImageUrl}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover border border-stone-200"
                          />
                        </button>
                        <div>
                          <div className="font-bold text-sm text-slate-900">
                            {req.storeName} — {req.planNameAr}
                          </div>
                          <div className="text-xs text-slate-500">
                            {req.paymentMethodName} • {formatDateAr(req.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm">{formatYer(req.amountYer)}</span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            req.status === "approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : req.status === "rejected"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {req.status === "approved"
                            ? "مقبول"
                            : req.status === "rejected"
                            ? "مرفوض"
                            : "معلّق"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SUBSCRIPTION PLANS CRUD */}
          {tab === "plans" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-stone-200">
                <h2 className="font-bold text-slate-900">باقات الاشتراك الشهرية</h2>
                <button
                  onClick={() => {
                    setEditingPlan(null);
                    setPlNameAr("");
                    setPlNameEn("");
                    setPlPrice("10000");
                    setPlMaxProds("30");
                    setPlMaxImgs("4");
                    setPlReports(true);
                    setPlSupport("دعم فني أولوية");
                    setPlDesc("");
                    setPlanModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold hover:bg-teal-800"
                >
                  <Plus className="w-4 h-4" />
                  إنشاء باقة جديدة
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-lg text-slate-900">{p.nameAr}</h3>
                        <span className="text-xs font-mono text-slate-500">{p.nameEn}</span>
                      </div>
                      <div className="text-2xl font-extrabold text-teal-700 mt-2">
                        {formatYer(p.priceYer)}
                      </div>
                      <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                        <li>• حتى {p.maxProducts} منتج</li>
                        <li>• حتى {p.maxImagesPerProduct} صور لكل منتج</li>
                        <li>• التقارير: {p.reportsEnabled ? "مفعّلة" : "غير مفعّلة"}</li>
                        <li>• {p.supportLevel}</li>
                      </ul>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-stone-100">
                      <button
                        onClick={() => {
                          setEditingPlan(p);
                          setPlNameAr(p.nameAr);
                          setPlNameEn(p.nameEn);
                          setPlPrice(String(p.priceYer));
                          setPlMaxProds(String(p.maxProducts));
                          setPlMaxImgs(String(p.maxImagesPerProduct));
                          setPlReports(p.reportsEnabled);
                          setPlSupport(p.supportLevel);
                          setPlDesc(p.descriptionAr || "");
                          setPlanModalOpen(true);
                        }}
                        className="flex-1 py-2 rounded-xl border border-stone-200 text-xs font-bold text-slate-700 hover:bg-stone-100"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => deletePlan(p.id)}
                        className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: PLATFORM PAYMENT METHODS */}
          {tab === "payments" && (
            <div className="space-y-6">
              <form
                onSubmit={createPlatformPayment}
                className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4"
              >
                <h2 className="font-extrabold text-base text-slate-900">
                  إضافة طريقة دفع جديدة على مستوى المنصة
                </h2>
                <div className="grid sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    value={pmNameAr}
                    onChange={(e) => setPmNameAr(e.target.value)}
                    placeholder="الاسم بالعربية (مثال: فلوسك)"
                    className="px-3 py-2 rounded-xl border border-stone-300 text-sm"
                  />
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={pmNameEn}
                    onChange={(e) => setPmNameEn(e.target.value)}
                    placeholder="English Name (e.g. Floosak)"
                    className="px-3 py-2 rounded-xl border border-stone-300 text-sm"
                  />
                  <select
                    value={pmType}
                    onChange={(e) => setPmType(e.target.value as "wallet" | "bank" | "cod")}
                    className="px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                  >
                    <option value="wallet">محفظة إلكترونية</option>
                    <option value="bank">تحويل بنكي</option>
                    <option value="cod">دفع نقدي</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold"
                  >
                    إضافة للمنصة
                  </button>
                </div>
              </form>

              <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
                <h2 className="font-extrabold text-base text-slate-900">
                  طرق الدفع المدعومة في المنصة (تفعيل/تعطيل شامل)
                </h2>
                <div className="divide-y divide-stone-100">
                  {paymentMethods.map((pm) => (
                    <div key={pm.id} className="py-3.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">
                          {pm.nameAr}{" "}
                          <span className="text-xs font-mono text-slate-500">({pm.nameEn})</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          النوع: {pm.type === "cod" ? "نقداً" : pm.type === "bank" ? "بنكي" : "محفظة"}
                        </div>
                      </div>
                      <button
                        onClick={() => togglePlatformPayment(pm)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold border ${
                          pm.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-stone-100 text-slate-600 border-stone-300"
                        }`}
                      >
                        {pm.isActive ? "مفعّلة بالمنصة (اضغط للتعطيل)" : "معطّلة بالمنصة (اضغط للتفعيل)"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Merchant Deep Details Modal */}
      {detailsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[88vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-extrabold text-lg">{detailsModal.merchant.storeName}</h3>
                <p className="text-xs text-slate-500">
                  المالك: {detailsModal.merchant.ownerName} • {detailsModal.merchant.ownerEmail}
                </p>
              </div>
              <button onClick={() => setDetailsModal(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border border-stone-200 rounded-xl p-4">
                <h4 className="font-bold text-sm mb-2">
                  المنتجات ({detailsModal.products.length})
                </h4>
                {detailsModal.products.length === 0 ? (
                  <p className="text-xs text-slate-500">لا توجد منتجات</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {detailsModal.products.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span>{p.name}</span>
                        <span className="font-bold">{formatYer(p.finalPrice)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border border-stone-200 rounded-xl p-4">
                <h4 className="font-bold text-sm mb-2">
                  طرق الدفع المفعّلة لدى التاجر
                </h4>
                {detailsModal.paymentMethods.filter((pm) => pm.enabled).length === 0 ? (
                  <p className="text-xs text-slate-500">لم يفعل أي طريقة دفع بعد</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {detailsModal.paymentMethods
                      .filter((pm) => pm.enabled)
                      .map((pm) => (
                        <li key={pm.id}>
                          <strong>{pm.nameAr}</strong>
                          {pm.accountNumber && ` — ${pm.accountHolderName} (${pm.accountNumber})`}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="border border-stone-200 rounded-xl p-4">
              <h4 className="font-bold text-sm mb-2">الطلبات ({detailsModal.orders.length})</h4>
              {detailsModal.orders.length === 0 ? (
                <p className="text-xs text-slate-500">لا توجد طلبات</p>
              ) : (
                <div className="space-y-2">
                  {detailsModal.orders.map((o) => {
                    const meta = ORDER_STATUS_META[o.status] || ORDER_STATUS_META.pending;
                    return (
                      <div key={o.id} className="flex justify-between items-center text-xs">
                        <span>
                          #{o.id} — {o.customerName} ({formatDateAr(o.createdAt)})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{formatYer(o.totalAmount)}</span>
                          <span className={`px-2 py-0.5 rounded-full border ${meta.badgeClass}`}>
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
        </div>
      )}

      {/* Manual Edit Merchant Modal */}
      {editMerchantModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={saveManualMerchantEdit}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base">تعديل بيانات التاجر يدوياً</h3>
              <button type="button" onClick={() => setEditMerchantModal(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم المتجر</label>
              <input
                type="text"
                value={editStoreName}
                onChange={(e) => setEditStoreName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الباقة</label>
              <select
                value={editPlanId}
                onChange={(e) => setEditPlanId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr} ({formatYer(p.priceYer)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الحالة</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
              >
                <option value="active">نشط</option>
                <option value="pending">بانتظار التفعيل</option>
                <option value="suspended">معلّق</option>
                <option value="expired">منتهي الاشتراك</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تمديد الاشتراك كاستثناء (عدد الأيام الإضافية)
              </label>
              <input
                type="number"
                min={0}
                value={editExtendDays}
                onChange={(e) => setEditExtendDays(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditMerchantModal(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold"
              >
                حفظ التعديلات
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPwMerchant && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={submitResetPassword}
            className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4"
          >
            <h3 className="font-extrabold text-base">
              إعادة تعيين كلمة مرور: {resetPwMerchant.storeName}
            </h3>
            <input
              type="password"
              required
              minLength={6}
              dir="ltr"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="كلمة المرور الجديدة (6 أحرف+)"
              className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetPwMerchant(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                تعيين كلمة المرور
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Plan CRUD Modal */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={savePlan}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <h3 className="font-extrabold text-base">
              {editingPlan ? "تعديل الباقة" : "إضافة باقة اشتراك"}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={plNameAr}
                onChange={(e) => setPlNameAr(e.target.value)}
                placeholder="الاسم بالعربية"
                className="px-3 py-2 rounded-xl border border-stone-300 text-sm"
              />
              <input
                type="text"
                required
                dir="ltr"
                value={plNameEn}
                onChange={(e) => setPlNameEn(e.target.value)}
                placeholder="Name (En)"
                className="px-3 py-2 rounded-xl border border-stone-300 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-bold">السعر (ريال)</label>
                <input
                  type="number"
                  required
                  value={plPrice}
                  onChange={(e) => setPlPrice(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold">أقصى منتجات</label>
                <input
                  type="number"
                  required
                  value={plMaxProds}
                  onChange={(e) => setPlMaxProds(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold">صور/منتج</label>
                <input
                  type="number"
                  required
                  value={plMaxImgs}
                  onChange={(e) => setPlMaxImgs(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-stone-300 text-sm"
                />
              </div>
            </div>
            <input
              type="text"
              value={plSupport}
              onChange={(e) => setPlSupport(e.target.value)}
              placeholder="مستوى الدعم الفني"
              className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={plReports}
                onChange={(e) => setPlReports(e.target.checked)}
              />
              تفعيل التقارير المتقدمة
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPlanModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold"
              >
                حفظ الباقة
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Zoomed Receipt Image Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <img
            src={previewImage}
            alt="إيصال التحويل"
            className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
