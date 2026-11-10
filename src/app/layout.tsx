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
  title: "ALQEMIA — Hub de Marketing & Ecommerce",
  description:
    "La academia premium de marketing y ecommerce. Comunidad, programas grabados, herramientas y gamificación para transmutar tu negocio.",
  applicationName: "ALQEMIA",
  authors: [{ name: "ALQEMIA" }],
  openGraph: {
    title: "ALQEMIA — Hub de Marketing & Ecommerce",
    description:
      "Comunidad, programas grabados, herramientas y gamificación para transmutar tu negocio en ventas.",
    type: "website",
    locale: "es",
    siteName: "ALQEMIA",
  },
  twitter: {
    card: "summary",
    title: "ALQEMIA — Hub de Marketing & Ecommerce",
    description: "Donde el marketing se transmuta en ventas.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070707",
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
