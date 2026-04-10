import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Barrio Stefani",
    template: "%s | Barrio Stefani",
  },
  description:
    "Loteo en Cuartel V, Moreno. Más de 360 lotes de 230 a 400 m² con infraestructura completa y financiación hasta 60 cuotas.",
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
    description:
      "Más de 360 lotes de 230 a 400 m² con infraestructura completa y financiación hasta 60 cuotas.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${cormorant.variable} ${jakarta.variable}`}
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
