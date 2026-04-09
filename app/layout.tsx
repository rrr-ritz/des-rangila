import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ServiceWorkerProvider } from "@/components/providers/ServiceWorkerProvider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "700"],
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
  themeColor: "#483932",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${playfair.variable} font-sans antialiased`}>
        <AuthProvider>
          <ServiceWorkerProvider />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
