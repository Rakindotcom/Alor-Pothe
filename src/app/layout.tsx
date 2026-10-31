import type { Metadata, Viewport } from "next";
import { Anek_Bangla } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

const anekBangla = Anek_Bangla({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-anek-bangla",
  display: "swap",
});

export const metadata: Metadata = {
  title: "আলোর পথে — পারিবারিক যিকির ট্র্যাকার",
  description: "আল্লাহর স্মরণে আমরা সবাই একসাথে — পারিবারিক যিকির ট্র্যাকার",
  applicationName: "আলোর পথে",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "আলোর পথে",
  },
  formatDetection: {
    telephone: false,
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#14532D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" className={anekBangla.variable}>
      <body className="antialiased selection:bg-[#DCFCE7] selection:text-[#14532D]">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
