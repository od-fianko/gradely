import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const publicSans = Public_Sans({
  subsets:  ["latin"],
  variable: "--font-sans",
  display:  "swap",
});

export const metadata: Metadata = {
  title: {
    default:  "Gradely",
    template: "%s | Gradely",
  },
  description:
    "AI-Assisted Assignment Management, Assessment and Learning Analytics Platform for Higher Education.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={publicSans.variable}>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
