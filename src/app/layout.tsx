import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { headers } from "next/headers";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { PWA } from "@/lib/pwa";
import { splashInitScript } from "@/lib/splash";
import { themeInitScript } from "@/lib/theme-mode";
import { themeColor } from "@/theme";
import { Splash } from "@/components/ds/Splash";
import { SplashGate } from "@/components/ds/SplashGate";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meta");
  return {
    title: t("title"),
    description: t("description"),
    // favicon.ico (legacy browsers) comes from src/app/favicon.ico; both are made from Buddy's glyph.
    icons: { icon: { url: PWA.favicon, type: "image/svg+xml" }, apple: PWA.appleTouchIcon },
    appleWebApp: { capable: true, title: "Buddy", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  // Use the whole screen in the installed app (components pad for the notch and home indicator with env(safe-area-*)),
  // and let the keyboard shrink the page on Android so a bottom-pinned button stays above it.
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: themeColor.light },
    { media: "(prefers-color-scheme: dark)", color: themeColor.dark },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Per-request CSP nonce (set in proxy.ts) only works on dynamically rendered pages.
  await connection();
  const locale = await getLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const t = await getTranslations("Meta");
  return (
    // data-theme is set by the script below before React hydrates, hence suppressHydrationWarning.
    <html lang={locale} className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInitScript + splashInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Splash title={t("title")} />
        <SplashGate />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
