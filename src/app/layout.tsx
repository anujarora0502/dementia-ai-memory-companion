import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

import DeviceWrapper from "@/components/DeviceWrapper";
import GlobalControls from "@/components/GlobalControls";

export const metadata: Metadata = {
  title: "AI Memory Companion",
  description: "A patient, empathetic conversational partner designed to help preserve personal memories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={outfit.className} style={{ margin: 0, padding: 0, backgroundColor: '#ffffff', overflow: 'hidden' }}>
        <DeviceWrapper>
          {children}
        </DeviceWrapper>
        <GlobalControls />
      </body>
    </html>
  );
}
