import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Footer from "../components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StackTrack Pro - Trading Card Collection & Marketplace",
  description: "The premier platform for sports card trading, auctions, and collection management. Track values, buy, sell, and trade Pokemon, Magic, and Yu-Gi-Oh cards.",
  keywords: ["trading cards", "sports cards", "Pokemon TCG", "Magic the Gathering", "Yu-Gi-Oh", "card marketplace", "card auctions", "collection management"],
  verification: {
    google: ["7RS5Fm4VV_hovIAtZ6bA7pyM9WifSdSgFQJEPqqEDMw", "XMr1m1sAKjIpEtX4VJFf1sQ6oX9_-qK4TdoRs6F78k0"],
  },
  openGraph: {
    title: "StackTrack Pro - Trading Card Collection & Marketplace",
    description: "Track, trade, and auction your trading cards with confidence.",
    url: "https://www.stacktrackpro.com",
    siteName: "StackTrack Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StackTrack Pro - Trading Card Collection & Marketplace",
    description: "Track, trade, and auction your trading cards with confidence.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="app-shell">
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
