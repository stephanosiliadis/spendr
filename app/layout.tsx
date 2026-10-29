import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/sidebar";
import { CookieBanner } from "@/components/cookie-banner/cookie-banner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Spendr — Smart Expense Tracker",
  description: "Track your income and expenses with beautiful insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {children}
            </main>
          </div>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
