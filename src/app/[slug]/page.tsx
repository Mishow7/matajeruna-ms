"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Store,
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Copy,
  Check,
  Loader2,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";
import { formatYer } from "@/lib/client-utils";

interface StoreMerchant {
  id: number;
  storeName: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  description?: string | null;
  city?: string | null;
  phone?: string | null;
  status: string;
}

interface StoreProduct {
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
}

interface StorePaymentMethod {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  type: "wallet" | "bank" | "cod";
  accountHolderName: string | null;
  accountNumber: string | null;
  bankName: string | null;
}

interface CartItem {
  productId: number;
  name: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  maxStock: number;
}

export default function StorefrontPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [merchant, setMerchant] = useState<StoreMerchant | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<StorePaymentMethod[]>([]);

  // Filtering
  const [searchQ, setSearchQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("الكل");

  // Product Detail & Gallery Modal
  const [activeProduct, setActiveProduct] = useState<StoreProduct | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [detailQty, setDetailQty] = useState(1);

  // Cart & Checkout Drawer
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "checkout" | "success">("cart");

  // Checkout Form
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cAddress, setCAddress] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [selectedPayId, setSelectedPayId] = useState<number>(0);
  const [paymentRef, setPaymentRef] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState<{
    id: number;
    totalAmount: number;
    paymentMethodName: string;
  } | null>(null);
  const [copiedAcct, setCopiedAcct] = useState(false);

  const loadStore = useCallback(async () => {
    try {
      const res = await fetch(`/api/stores?slug=${encodeURIComponent(slug)}`);
      if (res.status === 404) {
        setNotFoundError(true);
        return;
      }
      const data = await res.json();
      setMerchant(data.merchant);
      setIsLive(Boolean(data.isLive));
      setProducts(data.products || []);
      const pms: StorePaymentMethod[] = data.paymentMethods || [];
      setPaymentMethods(pms);
      if (pms.length > 0) {
        setSelectedPayId((prev) => (prev ? prev : pms[0].id));
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadStore();
    // Pre-fill logged-in user info if available
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setCName((prev) => prev || d.user.name || "");
          setCPhone((prev) => prev || d.user.phone || "");
        }
      })
      .catch(() => {});
  }, [loadStore]);

  // Load & Persist Cart per store slug
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`matajeruna_cart_${slug}`);
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, [slug]);

  useEffect(() => {
    try {
      localStorage.setItem(`matajeruna_cart_${slug}`, JSON.stringify(cart));
    } catch {}
  }, [cart, slug]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ["الكل", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "الكل" && p.category !== selectedCategory) return false;
      if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.description || "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [products, selectedCategory, searchQ]);

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

  function openProductDetail(product: StoreProduct) {
    setActiveProduct(product);
    setGalleryIndex(0);
    setDetailQty(product.stockQuantity > 0 ? 1 : 0);
  }

  function addToCart(product: StoreProduct, qty: number) {
    if (qty < 1 || product.stockQuantity < 1) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        const newQty = Math.min(product.stockQuantity, existing.quantity + qty);
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: newQty, unitPrice: product.finalPrice } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          image: product.images?.[0] || null,
          unitPrice: product.finalPrice,
          quantity: Math.min(product.stockQuantity, qty),
          maxStock: product.stockQuantity,
        },
      ];
    });
    setActiveProduct(null);
    setCheckoutStep("cart");
    setCartOpen(true);
  }

  function updateCartItemQty(productId: number, deltaOrValue: number, exact = false) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const next = exact ? deltaOrValue : item.quantity + deltaOrValue;
          return { ...item, quantity: Math.max(0, Math.min(item.maxStock, next)) };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function removeCartItem(productId: number) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  async function submitCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!merchant) return;
    setOrderError("");
    setSubmittingOrder(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId: merchant.id,
          paymentMethodId: selectedPayId,
          customerName: cName,
          customerPhone: cPhone,
          customerAddress: cAddress,
          paymentReference: paymentRef,
          notes: cNotes,
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrderError(data.error || "تعذر إتمام الطلب");
        return;
      }
      setConfirmedOrder(data.order);
      setCart([]);
      setCheckoutStep("success");
      loadStore();
    } catch {
      setOrderError("تعذر الاتصال بالخادم");
    } finally {
      setSubmittingOrder(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-teal-700" />
      </div>
    );
  }

  if (notFoundError || !merchant) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Store className="w-14 h-14 text-slate-300" />
        <h1 className="text-2xl font-extrabold text-slate-900">المتجر غير موجود</h1>
        <p className="text-sm text-slate-600">تأكد من رابط المتجر أو تصفح المتاجر المتاحة على متاجرنا.</p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-bold"
        >
          العودة لمنصة متاجرنا
        </Link>
      </div>
    );
  }

  if (!isLive) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">{merchant.storeName}</h1>
        <p className="text-sm text-slate-600 max-w-md">
          {merchant.status === "suspended"
            ? "هذا المتجر معلّق مؤقتاً من قبل إدارة المنصة."
            : merchant.status === "expired"
            ? "تم إيقاف رابط المتجر مؤقتاً لانتهاء مدة الاشتراك، وسيعود للعمل فور التجديد."
            : "هذا المتجر قيد التجهيز والمراجعة حالياً."}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold"
        >
          <ArrowRight className="w-4 h-4" />
          تصفح متاجر أخرى على متاجرنا
        </Link>
      </div>
    );
  }

  const brandColor = merchant.primaryColor || "#0f766e";
  const selectedPayment = paymentMethods.find((p) => p.id === selectedPayId);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Custom Storefront Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center text-white shrink-0 border border-stone-200"
              style={{ backgroundColor: brandColor }}
            >
              {merchant.logoUrl ? (
                <img
                  src={merchant.logoUrl}
                  alt={merchant.storeName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-base sm:text-lg text-slate-900 truncate">
                {merchant.storeName}
              </h1>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                {merchant.city && (
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin className="w-3 h-3" />
                    {merchant.city}
                  </span>
                )}
                {merchant.phone && (
                  <span className="inline-flex items-center gap-0.5 font-mono" dir="ltr">
                    <Phone className="w-3 h-3" />
                    {merchant.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              منصة متاجرنا
            </Link>
            <button
              onClick={() => {
                setCheckoutStep("cart");
                setCartOpen(true);
              }}
              className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>السلة</span>
              {cartCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-white text-slate-900 text-xs font-extrabold">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Store Hero Banner */}
      <section
        className="text-white py-8 px-4 sm:px-6"
        style={{ backgroundColor: brandColor }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold">{merchant.storeName}</h2>
            <p className="text-white/90 text-sm sm:text-base">
              {merchant.description || "أهلاً بكم في متجرنا الإلكتروني — جودة عالية وتوصيل سريع."}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {paymentMethods.map((pm) => (
              <span
                key={pm.id}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/15 border border-white/25"
              >
                ✓ {pm.nameAr}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Search & Categories Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 w-full space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? "text-white shadow-sm"
                    : "bg-white border border-stone-200 text-slate-700 hover:bg-stone-100"
                }`}
                style={selectedCategory === cat ? { backgroundColor: brandColor } : undefined}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="ابحث عن منتج..."
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">لا توجد منتجات مطابقة للعرض حالياً</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProducts.map((product) => {
              const hasDiscount = product.finalPrice < product.originalPrice;
              const outOfStock = product.stockQuantity <= 0;
              return (
                <div
                  key={product.id}
                  onClick={() => openProductDetail(product)}
                  className="group cursor-pointer bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="h-52 bg-stone-100 relative overflow-hidden">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <Store className="w-10 h-10" />
                        </div>
                      )}
                      {hasDiscount && (
                        <span className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-extrabold shadow">
                          {product.discountType === "percentage"
                            ? `خصم ${product.discountValue}%`
                            : `وفر ${formatYer(product.discountValue)}`}
                        </span>
                      )}
                      {product.images && product.images.length > 1 && (
                        <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-black/60 text-white text-[11px] font-bold">
                          +{product.images.length} صور
                        </span>
                      )}
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="text-[11px] font-bold text-slate-500">{product.category}</div>
                      <h3 className="font-bold text-slate-900 line-clamp-2 leading-snug">
                        {product.name}
                      </h3>
                      <div className="flex items-baseline gap-2 pt-1">
                        <span
                          className="font-extrabold text-lg"
                          style={{ color: brandColor }}
                        >
                          {formatYer(product.finalPrice)}
                        </span>
                        {hasDiscount && (
                          <span className="text-xs text-slate-400 line-through">
                            {formatYer(product.originalPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        openProductDetail(product);
                      }}
                      className="w-full py-2.5 rounded-xl text-white text-xs font-bold disabled:bg-stone-300 disabled:text-slate-500 transition hover:opacity-90"
                      style={!outOfStock ? { backgroundColor: brandColor } : undefined}
                    >
                      {outOfStock ? "نفدت الكمية" : "عرض التفاصيل وتحديد الكمية"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-5 text-center text-xs text-slate-500">
        مدعوم بواسطة{" "}
        <Link href="/" className="font-bold text-teal-700 hover:underline">
          منصة متاجرنا - Matajeruna
        </Link>
      </footer>

      {/* Product Detail Modal with Multi-Image Gallery & Quantity Selector */}
      {activeProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-stone-100 text-slate-700">
                {activeProduct.category}
              </span>
              <button
                onClick={() => setActiveProduct(null)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Image Gallery / Carousel */}
              <div className="space-y-3">
                <div className="relative h-72 sm:h-80 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200">
                  {activeProduct.images?.[galleryIndex] ? (
                    <img
                      src={activeProduct.images[galleryIndex]}
                      alt={activeProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Store className="w-12 h-12" />
                    </div>
                  )}
                  {activeProduct.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setGalleryIndex(
                            (i) => (i - 1 + activeProduct.images.length) % activeProduct.images.length
                          )
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center text-slate-800"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setGalleryIndex((i) => (i + 1) % activeProduct.images.length)
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center text-slate-800"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {activeProduct.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {activeProduct.images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setGalleryIndex(idx)}
                        className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 ${
                          galleryIndex === idx ? "border-teal-600" : "border-transparent opacity-70"
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Info + Price + Quantity Selector */}
              <div className="flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <h2 className="text-xl font-extrabold text-slate-900">{activeProduct.name}</h2>

                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-extrabold" style={{ color: brandColor }}>
                      {formatYer(activeProduct.finalPrice)}
                    </span>
                    {activeProduct.finalPrice < activeProduct.originalPrice && (
                      <span className="text-sm text-slate-400 line-through">
                        {formatYer(activeProduct.originalPrice)}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {activeProduct.description || "لا يوجد وصف إضافي لهذا المنتج."}
                  </p>

                  <div className="text-xs font-bold">
                    {activeProduct.stockQuantity > 0 ? (
                      <span className="text-emerald-700">
                        متوفر في المخزون ({activeProduct.stockQuantity} قطعة)
                      </span>
                    ) : (
                      <span className="text-rose-600">نفدت الكمية</span>
                    )}
                  </div>
                </div>

                {/* Quantity Selector before Add to Cart */}
                {activeProduct.stockQuantity > 0 && (
                  <div className="space-y-3 pt-4 border-t border-stone-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">تحديد الكمية:</span>
                      <div className="flex items-center border border-stone-300 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                          className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-slate-800"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={activeProduct.stockQuantity}
                          value={detailQty}
                          onChange={(e) =>
                            setDetailQty(
                              Math.max(
                                1,
                                Math.min(activeProduct.stockQuantity, Number(e.target.value) || 1)
                              )
                            )
                          }
                          className="w-14 text-center py-2 text-sm font-bold focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDetailQty((q) => Math.min(activeProduct.stockQuantity, q + 1))
                          }
                          className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-slate-800"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => addToCart(activeProduct, detailQty)}
                      className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm hover:opacity-95"
                      style={{ backgroundColor: brandColor }}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>
                        إضافة للسلة ({formatYer(activeProduct.finalPrice * detailQty)})
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shopping Cart & Checkout Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
            <div className="h-16 px-5 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-900">
                {checkoutStep === "cart"
                  ? `سلة التسوق (${cartCount})`
                  : checkoutStep === "checkout"
                  ? "إتمام الطلب والدفع"
                  : "تم استلام طلبك بنجاح"}
              </h3>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {checkoutStep === "cart" && (
                <>
                  {cart.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                      <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-700">سلة التسوق فارغة</p>
                      <p className="text-xs text-slate-500">
                        أضف منتجات من المتجر لمتابعة الطلب
                      </p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.productId}
                        className="border border-stone-200 rounded-2xl p-3.5 flex gap-3"
                      >
                        <div className="w-16 h-16 rounded-xl bg-stone-100 overflow-hidden shrink-0">
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-sm text-slate-900 line-clamp-1">
                              {item.name}
                            </h4>
                            <button
                              onClick={() => removeCartItem(item.productId)}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-xs text-slate-500">
                            سعر الوحدة: {formatYer(item.unitPrice)}
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden">
                              <button
                                onClick={() => updateCartItemQty(item.productId, -1)}
                                className="px-2 py-1 bg-stone-100 hover:bg-stone-200"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-3 text-xs font-bold">{item.quantity}</span>
                              <button
                                onClick={() => updateCartItemQty(item.productId, 1)}
                                className="px-2 py-1 bg-stone-100 hover:bg-stone-200"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="font-extrabold text-sm text-slate-900">
                              {formatYer(item.unitPrice * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {checkoutStep === "checkout" && (
                <form id="checkout-form" onSubmit={submitCheckout} className="space-y-4">
                  {orderError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                      {orderError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الاسم الكامل *
                    </label>
                    <input
                      type="text"
                      required
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      رقم الهاتف للتواصل *
                    </label>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      value={cPhone}
                      onChange={(e) => setCPhone(e.target.value)}
                      placeholder="77XXXXXXX"
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      عنوان التوصيل بالتفصيل *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={cAddress}
                      onChange={(e) => setCAddress(e.target.value)}
                      placeholder="المدينة - الحي - الشارع - أقرب معلم"
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm"
                    />
                  </div>

                  {/* Merchant Enabled Payment Methods ONLY */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-slate-700">
                      اختر طريقة الدفع المتاحة لدى التاجر *
                    </label>
                    {paymentMethods.length === 0 ? (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                        لم يفعّل التاجر أي طريقة دفع بعد.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {paymentMethods.map((pm) => (
                          <label
                            key={pm.id}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                              selectedPayId === pm.id
                                ? "border-teal-600 bg-teal-50/50"
                                : "border-stone-200"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="radio"
                                name="paymentMethod"
                                checked={selectedPayId === pm.id}
                                onChange={() => setSelectedPayId(pm.id)}
                                className="text-teal-700"
                              />
                              <span className="font-bold text-sm text-slate-900">{pm.nameAr}</span>
                            </div>
                            <Wallet className="w-4 h-4 text-slate-400" />
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Show Merchant Wallet/Bank Details for non-COD */}
                    {selectedPayment && selectedPayment.type !== "cod" && (
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2 text-xs">
                        <div className="font-bold text-slate-800">
                          بيانات التحويل المباشر لحساب التاجر ({selectedPayment.nameAr}):
                        </div>
                        {selectedPayment.bankName && (
                          <div>
                            البنك: <strong>{selectedPayment.bankName}</strong>
                          </div>
                        )}
                        <div>
                          اسم الحساب: <strong>{selectedPayment.accountHolderName}</strong>
                        </div>
                        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-stone-200">
                          <span className="font-mono font-bold text-sm text-teal-800" dir="ltr">
                            {selectedPayment.accountNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedPayment.accountNumber || "");
                              setCopiedAcct(true);
                              setTimeout(() => setCopiedAcct(false), 1800);
                            }}
                            className="inline-flex items-center gap-1 text-teal-700 font-bold"
                          >
                            {copiedAcct ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            {copiedAcct ? "نُسخ" : "نسخ"}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                          placeholder="أدخل رقم المرجع / الحوالة بعد التحويل (اختياري)"
                          className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs"
                        />
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    value={cNotes}
                    onChange={(e) => setCNotes(e.target.value)}
                    placeholder="ملاحظات إضافية للطلب (اختياري)"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </form>
              )}

              {checkoutStep === "success" && confirmedOrder && (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h4 className="font-extrabold text-xl text-slate-900">
                    تم إرسال طلبك #{confirmedOrder.id}
                  </h4>
                  <p className="text-sm text-slate-600">
                    شكراً لتسوقك من {merchant.storeName}. سيتواصل معك التاجر لتأكيد التوصيل.
                  </p>
                  <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 text-sm space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">طريقة الدفع:</span>
                      <strong>{confirmedOrder.paymentMethodName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">المبلغ الإجمالي:</span>
                      <strong className="text-teal-700">
                        {formatYer(confirmedOrder.totalAmount)}
                      </strong>
                    </div>
                  </div>
                  <button
                    onClick={() => setCartOpen(false)}
                    className="w-full py-3 rounded-xl text-white font-bold text-sm"
                    style={{ backgroundColor: brandColor }}
                  >
                    متابعة التسوق
                  </button>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            {checkoutStep === "cart" && cart.length > 0 && (
              <div className="p-5 border-t border-stone-200 space-y-3 bg-stone-50">
                <div className="flex items-center justify-between font-extrabold text-base">
                  <span>المجموع الكلي</span>
                  <span style={{ color: brandColor }}>{formatYer(cartTotal)}</span>
                </div>
                <button
                  onClick={() => setCheckoutStep("checkout")}
                  className="w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-sm hover:opacity-95"
                  style={{ backgroundColor: brandColor }}
                >
                  إتمام الطلب
                </button>
              </div>
            )}

            {checkoutStep === "checkout" && (
              <div className="p-5 border-t border-stone-200 space-y-2.5 bg-stone-50">
                <div className="flex items-center justify-between font-extrabold text-sm">
                  <span>المطلوب للدفع</span>
                  <span style={{ color: brandColor }}>{formatYer(cartTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep("cart")}
                    className="px-4 py-3 rounded-xl border border-stone-300 text-xs font-bold text-slate-700 bg-white"
                  >
                    رجوع للسلة
                  </button>
                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={submittingOrder || paymentMethods.length === 0}
                    className="flex-1 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50"
                    style={{ backgroundColor: brandColor }}
                  >
                    {submittingOrder ? "جاري إرسال الطلب..." : "تأكيد وإرسال الطلب"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
