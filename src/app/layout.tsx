import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Matajeruna - متاجرنا | منصة التجارة الإلكترونية للتجار في اليمن",
  description:
    "أنشئ متجرك الإلكتروني المستقل في اليمن خلال دقائق مع دعم جوالي، جيب، كريمي، محفظتي، التحويل البنكي والدفع عند الاستلام.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.className} bg-stone-50 text-slate-900 antialiased selection:bg-teal-100 selection:text-teal-900`}>
        {children}
      </body>
    </html>
  );
}
