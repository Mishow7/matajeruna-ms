export function formatYer(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString("en-US")} ريال`;
}

export function formatDateAr(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ar-YE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const MERCHANT_STATUS_META: Record<
  string,
  { label: string; badgeClass: string }
> = {
  active: { label: "نشط", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { label: "بانتظار التفعيل", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  suspended: { label: "معلّق", badgeClass: "bg-rose-50 text-rose-700 border-rose-200" },
  expired: { label: "منتهي الاشتراك", badgeClass: "bg-slate-100 text-slate-700 border-slate-300" },
};

export const ORDER_STATUS_META: Record<
  string,
  { label: string; badgeClass: string }
> = {
  pending: { label: "جديد", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  confirmed: { label: "مؤكد", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  shipped: { label: "قيد التوصيل", badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  delivered: { label: "تم التسليم", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "ملغي", badgeClass: "bg-rose-50 text-rose-700 border-rose-200" },
};

export async function readImageFileAsDataUrl(file: File, maxDim = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("فشل قراءة الصورة"));
    reader.onload = () => {
      const result = String(reader.result || "");
      // Keep GIFs intact if small, otherwise resize raster images on canvas
      if (file.type === "image/gif" || file.size < 160 * 1024) {
        resolve(result);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(outType, 0.82));
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}
