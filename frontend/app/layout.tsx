import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/context/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "HireIQ",
  description: "AI-native hiring platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
