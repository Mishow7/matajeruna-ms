"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  UserPlus,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Upload,
  Wallet,
} from "lucide-react";
import { formatYer, readImageFileAsDataUrl } from "@/lib/client-utils";

interface Plan {
  id: number;
  nameAr: string;
  priceYer: number;
  maxProducts: number;
  maxImagesPerProduct: number;
  supportLevel: string;
}

interface PlatformWallets {
  instructions?: string;
  accounts?: Array<{ method: string; accountName: string; accountNumber: string }>;
}

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"merchant" | "customer">("merchant");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [wallets, setWallets] = useState<PlatformWallets | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Merchant fields
  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("صنعاء");
  const [planId, setPlanId] = useState<number>(0);

  // Slug checking
  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    normalized: string;
    reason: string | null;
  }>({ checking: false, available: null, normalized: "", reason: null });

  // Optional receipt upload on signup
  const [attachReceipt, setAttachReceipt] = useState(true);
  const [paymentMethodName, setPaymentMethodName] = useState("جوالي (Jawali)");
  const [receiptImageUrl, setReceiptImageUrl] = useState("");
  const [transferNote, setTransferNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPlan = Number(params.get("plan"));

    fetch("/api/stores")
      .then((r) => r.json())
      .then((data) => {
        const list: Plan[] = data.plans || [];
        setPlans(list);
        setWallets(data.subscriptionWallets || null);
        if (requestedPlan && list.some((p) => p.id === requestedPlan)) {
          setPlanId(requestedPlan);
        } else if (list.length > 0) {
          setPlanId(list[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (role !== "merchant" || !slug.trim()) {
      setSlugStatus({ checking: false, available: null, normalized: "", reason: null });
      return;
    }

    const timer = setTimeout(async () => {
      setSlugStatus((prev) => ({ ...prev, checking: true }));
      try {
        const res = await fetch(`/api/stores?checkSlug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        setSlugStatus({
          checking: false,
          available: Boolean(data.available),
          normalized: data.normalized || "",
          reason: data.reason || null,
        });
      } catch {
        setSlugStatus({ checking: false, available: null, normalized: "", reason: null });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [slug, role]);

  async function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file, 900);
      setReceiptImageUrl(dataUrl);
    } catch {
      setError("تعذر قراءة صورة الإيصال");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (role === "merchant") {
      if (slugStatus.available === false) {
        setError(slugStatus.reason || "رابط المتجر غير متاح");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          role,
          name,
          email,
          phone,
          password,
          storeName,
          slug,
          city,
          planId,
          receiptImageUrl: attachReceipt ? receiptImageUrl : undefined,
          paymentMethodName: attachReceipt ? paymentMethodName : undefined,
          transferNote: attachReceipt ? transferNote : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "فشل إنشاء الحساب");
        return;
      }
      if (role === "merchant") router.push("/merchant");
      else router.push("/");
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  const selectedPlan = plans.find((p) => p.id === planId);

  return (
    <div className="min-h-screen bg-stone-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-sm">
              <Store className="w-6 h-6" />
            </div>
            <div className="text-right">
              <span className="font-extrabold text-xl text-slate-900 block leading-none">
                متاجرنا
              </span>
              <span className="text-[11px] font-bold text-teal-700">MATAJERUNA</span>
            </div>
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-4">إنشاء حساب جديد</h1>
          <p className="text-sm text-slate-600 mt-1">
            اختر نوع الحساب وأنشئ متجرك الإلكتروني المستقل في اليمن
          </p>
        </div>

        {/* Role Selector */}
        <div className="grid grid-cols-2 gap-3 bg-white p-1.5 rounded-2xl border border-stone-200">
          <button
            type="button"
            onClick={() => setRole("merchant")}
            className={`py-2.5 rounded-xl text-sm font-bold transition ${
              role === "merchant"
                ? "bg-teal-700 text-white shadow-sm"
                : "text-slate-600 hover:bg-stone-100"
            }`}
          >
            تسجيل كتاجر (افتح متجرك)
          </button>
          <button
            type="button"
            onClick={() => setRole("customer")}
            className={`py-2.5 rounded-xl text-sm font-bold transition ${
              role === "customer"
                ? "bg-teal-700 text-white shadow-sm"
                : "text-slate-600 hover:bg-stone-100"
            }`}
          >
            تسجيل كعميل متسوق
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5"
        >
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                الاسم الكامل
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: محمد العولقي"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                رقم الهاتف اليمني
              </label>
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="77XXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="store@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                كلمة المرور (6 أحرف على الأقل)
              </label>
              <input
                type="password"
                required
                minLength={6}
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          {role === "merchant" && (
            <>
              <hr className="border-stone-200" />
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    اسم المتجر
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="مثال: متجر السعيدة للعطور"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    المدينة / المحافظة
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="صنعاء / عدن / تعز / المكلا"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              {/* Unique Store Slug Input with Real-time Check */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  رابط متجرك المستقل (Slug بالإنجليزية)
                </label>
                <div className="flex items-center border border-stone-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-600" dir="ltr">
                  <span className="bg-stone-100 px-3 py-2.5 text-xs font-mono text-slate-500 border-r border-stone-300">
                    matajeruna.com/
                  </span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="my-yemen-store"
                    className="flex-1 px-3 py-2.5 text-sm font-mono focus:outline-none"
                  />
                </div>
                <div className="mt-1.5 min-h-[20px] text-xs flex items-center gap-1.5">
                  {slugStatus.checking && (
                    <span className="text-slate-500 flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      جاري التحقق من توفر الرابط...
                    </span>
                  )}
                  {!slugStatus.checking && slugStatus.available === true && (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      الرابط /{slugStatus.normalized} متاح ومميز!
                    </span>
                  )}
                  {!slugStatus.checking && slugStatus.available === false && (
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      {slugStatus.reason}
                    </span>
                  )}
                </div>
              </div>

              {/* Plan Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  اختر باقة الاشتراك الشهرية
                </label>
                <div className="grid sm:grid-cols-3 gap-3">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlanId(p.id)}
                      className={`p-3.5 rounded-xl border text-right transition ${
                        planId === p.id
                          ? "border-teal-600 bg-teal-50/70 ring-1 ring-teal-600"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <div className="font-bold text-sm text-slate-900">{p.nameAr}</div>
                      <div className="text-teal-700 font-extrabold text-base mt-1">
                        {formatYer(p.priceYer)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        حتى {p.maxProducts} منتج • {p.maxImagesPerProduct} صور
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subscription Payment Receipt Upload */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                    <Wallet className="w-4 h-4 text-teal-700" />
                    <span>تفعيل الاشتراك عبر التحويل لمحفظة المنصة</span>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attachReceipt}
                      onChange={(e) => setAttachReceipt(e.target.checked)}
                      className="rounded text-teal-700"
                    />
                    إرفاق الإيصال الآن
                  </label>
                </div>

                {selectedPlan && (
                  <p className="text-xs text-slate-600">
                    قيمة الباقة المختارة: <strong className="text-teal-800">{formatYer(selectedPlan.priceYer)}</strong> شهرياً.
                    {wallets?.instructions && ` ${wallets.instructions}`}
                  </p>
                )}

                {wallets?.accounts && (
                  <div className="grid sm:grid-cols-3 gap-2">
                    {wallets.accounts.map((acc, i) => (
                      <div key={i} className="bg-white border border-stone-200 rounded-lg p-2.5 text-xs">
                        <div className="font-bold text-slate-800">{acc.method}</div>
                        <div className="text-slate-500 mt-0.5">{acc.accountName}</div>
                        <div className="font-mono font-bold text-teal-700 mt-0.5" dir="ltr">
                          {acc.accountNumber}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {attachReceipt && (
                  <div className="grid sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        المحفظة المحوّل إليها
                      </label>
                      <select
                        value={paymentMethodName}
                        onChange={(e) => setPaymentMethodName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                      >
                        <option value="جوالي (Jawali)">جوالي (Jawali)</option>
                        <option value="جيب (Jaib)">جيب (Jaib)</option>
                        <option value="بنك الكريمي">بنك الكريمي</option>
                        <option value="محفظتي">محفظتي</option>
                        <option value="تحويل بنكي">تحويل بنكي</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        صورة إيصال التحويل
                      </label>
                      <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-teal-400 bg-white text-xs font-semibold text-teal-700 cursor-pointer hover:bg-teal-50">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{receiptImageUrl ? "تم إرفاق الإيصال ✓" : "اختر صورة الإيصال"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptFile}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={transferNote}
                        onChange={(e) => setTransferNote(e.target.value)}
                        placeholder="رقم العملية أو ملاحظة التحويل (اختياري)"
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
          >
            <UserPlus className="w-4 h-4" />
            {loading
              ? "جاري إنشاء الحساب..."
              : role === "merchant"
              ? "إنشاء المتجر والانتقال للوحة التحكم"
              : "إنشاء حساب العميل"}
          </button>

          <p className="text-center text-sm text-slate-600">
            لديك حساب بالفعل؟{" "}
            <Link href="/login" className="text-teal-700 font-bold hover:underline">
              سجّل الدخول
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
