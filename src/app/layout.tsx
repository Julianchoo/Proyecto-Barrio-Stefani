import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  icons: {
    icon: { url: "/torre-agua.svg", type: "image/svg+xml", sizes: "any" },
    shortcut: "/torre-agua.svg",
  },
  title: {
    default: "Barrio Stefani",
    template: "%s | Barrio Stefani",
  },
  description:
    "Loteo en Cuartel V, Moreno. Lotes residenciales y comerciales de 200 a 400 m² con infraestructura completa, escritura y financiación en hasta 60 cuotas.",
  keywords: [
    "loteo",
    "Moreno",
    "Barrio Stefani",
    "lotes",
    "terrenos",
    "Buenos Aires",
    "Cuartel V",
  ],
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Barrio Stefani",
    title: "Barrio Stefani — Lotes en Cuartel V, Moreno",
    images: [{ url: "/aerea_2026_3.jpeg", width: 1600, height: 900, alt: "Vista aérea de Barrio Stefani" }],
    description:
      "Lotes residenciales y comerciales de 200 a 400 m² con infraestructura completa, escritura y financiación en hasta 60 cuotas.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${cormorant.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased font-body">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
