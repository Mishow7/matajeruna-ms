"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, LogIn, ShieldCheck, ShoppingBag, UserCheck, AlertCircle } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    label: "Super Admin (صاحب المنصة)",
    email: "admin@matajeruna.com",
    password: "admin123",
    badge: "تحكم كامل",
    icon: ShieldCheck,
  },
  {
    label: "تاجر نشط - بن حراز (sanaa-coffee)",
    email: "coffee@matajeruna.com",
    password: "merchant123",
    badge: "باقة Pro",
    icon: Store,
  },
  {
    label: "تاجر نشط - عدن تك (aden-tech)",
    email: "tech@matajeruna.com",
    password: "merchant123",
    badge: "قرب الانتهاء",
    icon: Store,
  },
  {
    label: "عميل متسوق",
    email: "customer@matajeruna.com",
    password: "customer123",
    badge: "عميل",
    icon: ShoppingBag,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitLogin(loginEmail: string, loginPassword: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "فشل تسجيل الدخول");
        return;
      }
      if (data.user?.role === "super_admin") router.push("/admin");
      else if (data.user?.role === "merchant") router.push("/merchant");
      else router.push("/");
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center py-10 px-4">
      <div className="max-w-md w-full mx-auto space-y-6">
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
          <h1 className="text-2xl font-extrabold text-slate-900 mt-5">تسجيل الدخول</h1>
          <p className="text-sm text-slate-600 mt-1">
            ادخل إلى لوحة تحكم متجرك أو حسابك في المنصة
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitLogin(email, password);
            }}
            className="space-y-4"
          >
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
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                كلمة المرور
              </label>
              <input
                type="password"
                required
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
            >
              <LogIn className="w-4 h-4" />
              {loading ? "جاري الدخول..." : "دخول"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600 pt-2">
            ليس لديك حساب؟{" "}
            <Link href="/register" className="text-teal-700 font-bold hover:underline">
              أنشئ متجرك أو سجل الآن
            </Link>
          </p>
        </div>

        {/* One-Click Demo Login Box */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <UserCheck className="w-4 h-4 text-teal-700" />
            <span>دخول تجريبي سريع (للمعاينة الفورية):</span>
          </div>
          <div className="grid gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.email}
                  type="button"
                  disabled={loading}
                  onClick={() => submitLogin(acc.email, acc.password)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-stone-200 hover:border-teal-400 hover:bg-teal-50/50 text-right transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-teal-700 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{acc.label}</div>
                      <div className="text-[11px] text-slate-500 font-mono" dir="ltr">
                        {acc.email}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-slate-700">
                    {acc.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
