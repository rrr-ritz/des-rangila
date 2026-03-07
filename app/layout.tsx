import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ServiceWorkerProvider } from "@/components/providers/ServiceWorkerProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Des Rangila — Tour of India",
  description:
    "Digital Passport for Des Rangila, a mela/bazaar-style Tour of India festival hosted by UMD's Indian Student Association.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Des Rangila",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <ServiceWorkerProvider />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
