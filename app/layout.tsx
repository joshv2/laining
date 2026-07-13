import type { Metadata } from "next";
import { Geist_Mono, Noto_Serif_Hebrew, Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-geist-sans",
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerifHebrew = Noto_Serif_Hebrew({
  variable: "--font-hebrew",
  subsets: ["hebrew", "latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Laining Collaborative",
  description: "A collaborative platform for learning and sharing Torah, Neviim, and Ketuvim chanting recordings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${rubik.variable} ${geistMono.variable} ${notoSerifHebrew.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
