import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoginForm, SignUpForm } from "@/components/AuthForms";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AppChromeProvider } from "@/components/ds";
import { HomeView } from "@/components/home/HomeView";
import { TabPlaceholder } from "@/components/home/TabPlaceholder";
import { MeView } from "@/components/me/MeView";
import Landing from "@/app/page";
import { GAME_PREVIEW } from "@/lib/game-layer";
import { FlashcardDemo } from "../../demos";

// Dev tool: the desktop layouts (1024px and up) as real full-page screens, so they respond to the window like the app does.
// Open one in a wide window: /design/desktop/home?theme=dark&game=0. Same gating as /design.
export const metadata: Metadata = { title: "Design: desktop", robots: { index: false, follow: false } };

const SCREENS = ["landing", "login", "signup", "home", "learn", "play", "me", "flashcard"] as const;
type Screen = (typeof SCREENS)[number];

export default async function DesktopPreview({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DESIGN_PAGE !== "1") notFound();
  const { screen } = await params;
  if (!(SCREENS as readonly string[]).includes(screen)) notFound();
  const { theme, game } = await searchParams;
  const dark = theme === "dark";
  const light = theme === "light";
  const withGame = game !== "0";
  const name = screen as Screen;

  return (
    <div data-theme={dark ? "dark" : light ? "light" : undefined} className="theme-scope flex min-h-dvh flex-col">
      <AppChromeProvider value={{ initial: "R", due: 49 }}>
        {name === "landing" ? <Landing /> : null}
        {name === "login" ? (
          <AuthLayout title="Welcome back" line="Schön, dich zu sehen!" helper="Good to see you!" formTitle="Log in" formSubtitle="Pick up where you left off." pose="neutral">
            <LoginForm />
          </AuthLayout>
        ) : null}
        {name === "signup" ? (
          <AuthLayout title="Create your account" line="Lass uns anfangen!" helper="Let's get started!" formTitle="Create account" pose="talking">
            <SignUpForm googleEnabled />
          </AuthLayout>
        ) : null}
        {name === "home" ? (
          <HomeView
            name="Raghav"
            line="Heute bestellen wir Kaffee!"
            lesson={{ day: 11, code: "Z9", title: "Essen & Trinken" }}
            due={49}
            dueDetail={{ reviews: 29, fresh: 20 }}
            dateLabel="Dienstag, 20. Oktober"
            game={withGame ? GAME_PREVIEW : null}
          />
        ) : null}
        {name === "learn" ? <TabPlaceholder tab="learn" /> : null}
        {name === "play" ? <TabPlaceholder tab="play" /> : null}
        {name === "me" ? <MeView name="Raghav" /> : null}
        {name === "flashcard" ? <FlashcardDemo game={withGame} /> : null}
      </AppChromeProvider>
    </div>
  );
}
