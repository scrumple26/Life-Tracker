import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "lifelong",
  description:
    "A warm place to keep the games, trips, meals, and shows you've lived.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "lifelong",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#c2603d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
