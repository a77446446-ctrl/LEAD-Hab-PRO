import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://podelam24.ru'),
  title: "ПО ДЕЛАМ - Агрегатор заказов",
  description: "Поиск работы и специалистов, подработки. Все для строительства и ремонта: мастер на час, грузчики и другие услуги.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  verification: {
    yandex: "46cd23352c691aac",
  },
  openGraph: {
    title: "ПО ДЕЛАМ - Свежие заказы и работа",
    description: "Агрегатор заказов по всем городам. Найди подработку, работу или крутых специалистов: мастер на час, грузчики, IT и многое другое.",
    url: "https://podelam24.ru",
    siteName: "ПО ДЕЛАМ",
    images: [
      {
        url: "/preview-banner.jpg", // Сюда нужно будет положить широкую картинку 1200x630 в папку public
        width: 1200,
        height: 630,
        alt: "Превью приложения ПО ДЕЛАМ",
      },
    ],
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ПО ДЕЛАМ - Свежие заказы и работа",
    description: "Агрегатор заказов по всем городам. Найди подработку, работу или крутых специалистов.",
    images: ["/preview-banner.jpg"],
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
        <meta name="color-scheme" content="only light" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <Script src="https://st.max.ru/js/max-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="bg-[#efefef] text-black antialiased">{children}</body>
    </html>
  );
}
