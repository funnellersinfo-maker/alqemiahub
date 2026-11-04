import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ALQEMIRA — Hub de Marketing & Ecommerce",
  description:
    "La academia premium de marketing y ecommerce. Comunidad, programas grabados, herramientas y gamificación para transmutar tu negocio.",
  applicationName: "ALQEMIRA",
  authors: [{ name: "ALQEMIRA" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} font-sans antialiased bg-background text-foreground min-h-dvh`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
