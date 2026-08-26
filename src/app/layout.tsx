import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "ПО ДЕЛАМ - Агрегатор заказов",
  description: "Поиск работы и специалистов, подработки. Все для строительства и ремонта: мастер на час, грузчики и другие услуги.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "ПО ДЕЛАМ - Агрегатор заказов",
    description: "Поиск работы и специалистов, подработки. Все для строительства и ремонта: мастер на час, грузчики и другие услуги.",
    images: ["/icon.png"],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <Script src="https://st.max.ru/js/max-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="bg-[#efefef] text-black antialiased">{children}</body>
    </html>
  );
}
