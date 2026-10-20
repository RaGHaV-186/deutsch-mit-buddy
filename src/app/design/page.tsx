import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArticleWord,
  BUDDY_POSES,
  CheckboxField,
  Divider,
  PasswordStrength,
  SelectField,
  StickyActions,
  BuddyMascot,
  CoatHeader,
  Cushion,
  DueCardsTile,
  EmptyState,
  FloatingTabBar,
  LevelCard,
  PasswordField,
  PawStreakWeek,
  PillButton,
  Skeleton,
  SpeechBubble,
  Splash,
  TextField,
  TreatChip,
  WedgeProgress,
  type DayStatus,
  type PillVariant,
  type TabId,
  CodeInput,
  BoneIcon,
  PawIcon,
  SpeakerIcon,
  CloseIcon,
} from "@/components/ds";
import { colors, type ColorToken } from "@/theme";
import { HomeSkeleton } from "@/components/home/HomeSkeleton";
import { HomeView } from "@/components/home/HomeView";
import { GAME_PREVIEW } from "@/lib/game-layer";
import { CodeDemo, ErrorDemo, ToastDemo } from "./demos";

// Dev tool: every design-system component in light and dark, side by side, with all its states.
// Hidden in production unless SHOW_DESIGN_PAGE=1 (the route is behind login either way).
export const metadata: Metadata = { title: "Design", robots: { index: false, follow: false } };

const MODES = ["light", "dark"] as const;

function Pair({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {MODES.map((mode) => (
        <div key={mode} data-theme={mode} className="theme-scope flex flex-col gap-4 rounded-[24px] p-5 ring-1 ring-track">
          <p className="text-label uppercase text-muted">{mode}</p>
          {children}
        </div>
      ))}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-title">{title}</h2>
        {note ? <p className="text-caption text-muted">{note}</p> : null}
      </div>
      <Pair>{children}</Pair>
    </section>
  );
}

function Row({ label, children, force }: { label: string; children: ReactNode; force?: "pressed" | "focus" }) {
  return (
    <div data-force={force} className="flex flex-col gap-1.5">
      <p className="text-caption text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** A coat-coloured strip, for components that live on the coat block. */
function OnCoat({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-[24px] bg-coat p-4 text-on-coat">{children}</div>;
}

const TOKENS = Object.keys(colors.light) as ColorToken[];
const WEEK: DayStatus[] = ["done", "today", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming"];
const WEEK_FULL: DayStatus[] = ["done", "done", "done", "missed", "done", "done", "upcoming"];
const TABS: TabId[] = ["home", "learn", "cards", "play", "me"];
const BUTTONS: PillVariant[] = ["blaze", "coat", "cushion", "outline-on-coat", "ghost"];

function ButtonStates({ variant }: { variant: PillVariant }) {
  const wrap = (children: ReactNode) =>
    variant === "blaze" || variant === "outline-on-coat" ? (
      <OnCoat>{children}</OnCoat>
    ) : (
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-label uppercase">{variant}</p>
      {wrap(
        <>
          <PillButton variant={variant}>Default</PillButton>
          <div data-force="pressed">
            <PillButton variant={variant}>Pressed</PillButton>
          </div>
          <div data-force="focus">
            <PillButton variant={variant}>Focus</PillButton>
          </div>
          <PillButton variant={variant} disabled>
            Disabled
          </PillButton>
          <PillButton variant={variant} loading>
            Loading
          </PillButton>
        </>,
      )}
    </div>
  );
}

export default function DesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DESIGN_PAGE !== "1") notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10">
      <header>
        <h1 className="text-display">Design system</h1>
        <p className="text-muted">Every component in light and dark, with its states. Dev tool, not part of the app.</p>
      </header>

      <Section title="Colour tokens" note="docs/DESIGN_BRIEF.md plus --progress and --focus.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TOKENS.map((token) => (
            <div key={token} className="flex items-center gap-2 text-caption">
              <span className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-black/15" style={{ background: `var(--${token})` }} />
              <span className="tabular">--{token}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type scale">
        <p className="text-display">Hallo, Raghav! (display)</p>
        <p className="text-title">Essen &amp; Trinken (title)</p>
        <p className="text-word">Kaffee (word)</p>
        <p className="text-headline">Level 3 (headline)</p>
        <p className="text-body">Ich trinke einen Kaffee. (body)</p>
        <p className="text-label uppercase">Day 11 · Z9 (label)</p>
        <p className="text-caption text-muted">Level 3 · 1,240 treats (caption)</p>
        <p className="tabular text-headline">1,240 / 1,500 0123456789 (tabular)</p>
      </Section>

      <Section title="Icons" note="24px grid, 2px stroke, currentColor.">
        <div className="flex flex-wrap items-center gap-4">
          <PawIcon /> <BoneIcon /> <SpeakerIcon /> <CloseIcon />
        </div>
      </Section>

      <Section title="BuddyMascot" note="Six poses.">
        <div className="grid grid-cols-3 gap-3">
          {BUDDY_POSES.map((pose) => (
            <figure key={pose} className="flex flex-col items-center gap-1 text-caption text-muted">
              <BuddyMascot pose={pose} size={84} />
              <figcaption>{pose}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section title="CoatHeader, BlazeNotch, SpeechBubble, TreatChip">
        <div className="overflow-hidden rounded-[24px]">
          <CoatHeader className="!pt-8">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col items-start gap-3">
                <h3 className="text-display">Hallo, Raghav!</h3>
                <SpeechBubble>Heute bestellen wir Kaffee!</SpeechBubble>
              </div>
              <BuddyMascot pose="happy" size={58} />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-label uppercase text-on-coat-muted tabular">Day 11 · Z9</span>
              <TreatChip>+50 treats</TreatChip>
            </div>
            <h3 className="mt-2 text-title">Essen &amp; Trinken</h3>
            <PillButton variant="blaze" fullWidth className="mt-4">
              Continue
            </PillButton>
          </CoatHeader>
        </div>
        <p className="text-caption text-muted">compact (auth screens)</p>
        <div className="overflow-hidden rounded-[24px]">
          <CoatHeader compact className="!pt-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col items-start gap-2">
                <h3 className="text-display">Welcome back!</h3>
                <SpeechBubble>Schön, dich zu sehen!</SpeechBubble>
              </div>
              <BuddyMascot pose="neutral" size={72} />
            </div>
          </CoatHeader>
        </div>
        <Row label="SpeechBubble on a white area">
          <SpeechBubble onSurface>Guten Morgen!</SpeechBubble>
        </Row>
      </Section>

      <Section title="PillButton" note="Variants × states. Pressed and focus are forced so you can see them.">
        {BUTTONS.map((variant) => (
          <ButtonStates key={variant} variant={variant} />
        ))}
        <Row label="Sizes 44 / 56 / 60 and full width">
          <PillButton variant="coat" size={44}>
            44
          </PillButton>
          <PillButton variant="coat" size={56}>
            56
          </PillButton>
          <PillButton variant="coat" size={60}>
            60
          </PillButton>
        </Row>
        <PillButton variant="coat" fullWidth>
          Full width
        </PillButton>
        <Row label="With icon (on the coat strip)">
          <OnCoat>
            <PillButton variant="blaze" size={44} icon={<SpeakerIcon size={20} />}>
              Play
            </PillButton>
            <PillButton variant="outline-on-coat" size={44}>
              Slow
            </PillButton>
          </OnCoat>
        </Row>
      </Section>

      <Section title="Cushion" note="Plain, link, button, pressed, focus, disabled.">
        <Cushion className="p-4">Plain cushion</Cushion>
        <Cushion href="/design" className="p-4">
          Link cushion
        </Cushion>
        <Row label="Pressed" force="pressed">
          <div className="w-full">
            <Cushion href="/design" className="p-4">
              Pressed cushion
            </Cushion>
          </div>
        </Row>
        <Row label="Focus" force="focus">
          <div className="w-full">
            <Cushion href="/design" className="p-4">
              Focused cushion
            </Cushion>
          </div>
        </Row>
      </Section>

      <Section title="TextField, PasswordField" note="Default, filled, focus, error, disabled, hint.">
        <TextField label="Email" placeholder="you@example.com" type="email" />
        <TextField label="Email" defaultValue="anna@example.com" type="email" hint="We never share it." />
        <div data-force="focus">
          <TextField label="Focused" defaultValue="anna@example.com" />
        </div>
        <TextField label="Email" defaultValue="anna@example" error="Please enter a valid email address." />
        <TextField label="Disabled" defaultValue="Locked" disabled />
        <PasswordField label="Password" defaultValue="hunter2hunter2" />
        <PasswordField label="Password" defaultValue="short" error="At least 10 characters." />
      </Section>

      <Section title="Form parts" note="SelectField, CheckboxField, Divider, PasswordStrength (short / okay / strong) and StickyActions (pinned to the bottom of a form).">
        <SelectField label="Starting lesson" defaultValue="1">
          <option value="1">Z1 · Greetings</option>
          <option value="2">Z2 · Pronouns</option>
        </SelectField>
        <CheckboxField name="demo-terms">I am 16 or older and accept the Terms</CheckboxField>
        <CheckboxField name="demo-checked" defaultChecked>
          Checked
        </CheckboxField>
        <Divider>or</Divider>
        <PasswordStrength password="short" />
        <PasswordStrength password="twelve-chars" />
        <PasswordStrength password="a-much-longer-passphrase" />
        <StickyActions>
          <PillButton fullWidth>Primary action</PillButton>
        </StickyActions>
      </Section>

      <Section title="CodeInput" note="Empty (interactive), filled, focus, error, disabled.">
        <CodeDemo />
        <Row label="Filled">
          <CodeInput value="482915" />
        </Row>
        <div data-force="focus">
          <Row label="Focus">
            <CodeInput value="48" />
          </Row>
        </div>
        <Row label="Error">
          <CodeInput value="000000" error />
        </Row>
        <Row label="Disabled">
          <CodeInput value="" disabled />
        </Row>
      </Section>

      <Section title="WedgeProgress" note="On the page the fill is --progress; on the coat block it is --on-coat.">
        <WedgeProgress value={0} label="Empty" />
        <WedgeProgress value={0.35} label="35 percent" />
        <WedgeProgress value={0.83} height={14} marker label="83 percent with paw" />
        <WedgeProgress value={1} label="Full" />
        <OnCoat>
          <div className="w-full">
            <WedgeProgress value={0.6} onCoat label="On the coat block" />
          </div>
        </OnCoat>
      </Section>

      <Section title="ArticleWord" note="der / die / das by gender; plural articles are muted.">
        <p className="text-word">
          <ArticleWord article="der" word="Kaffee" />
        </p>
        <p className="text-word">
          <ArticleWord article="die" word="Stadt" />
        </p>
        <p className="text-word">
          <ArticleWord article="das" word="Land" />
        </p>
        <p className="text-headline">
          <ArticleWord article={null} word="heißen" /> · <ArticleWord article="die" word="Kaffees" plural />
        </p>
      </Section>

      <Section title="Home" note="The real Home screen with the game layer off (what production shows) and on (preview numbers), and its loading state.">
        <p className="text-caption text-muted">game layer off</p>
        <div className="overflow-hidden rounded-[24px]">
          <HomeView name="Raghav" line="Heute geht's um Essen & Trinken!" lesson={{ day: 11, code: "Z9", title: "Essen & Trinken" }} due={29} game={null} tabBar="static" />
        </div>
        <p className="text-caption text-muted">game layer on (preview data)</p>
        <div className="overflow-hidden rounded-[24px]">
          <HomeView name="Raghav" line="Heute geht's um Essen & Trinken!" lesson={{ day: 11, code: "Z9", title: "Essen & Trinken" }} due={29} game={GAME_PREVIEW} tabBar="static" />
        </div>
        <p className="text-caption text-muted">loading</p>
        <div className="overflow-hidden rounded-[24px]">
          <HomeSkeleton game={false} tabBar="static" />
        </div>
      </Section>

      <Section title="PawStreakWeek, LevelCard, DueCardsTile">
        <PawStreakWeek streak={10} days={WEEK} />
        <PawStreakWeek streak={5} days={WEEK_FULL} />
        <div className="grid grid-cols-[1.4fr_1fr] gap-3">
          <LevelCard level={3} treats={1240} nextAt={1500} />
          <DueCardsTile count={29} />
        </div>
      </Section>

      <Section title="FloatingTabBar" note="Each tab active; the Play dot is the badge.">
        {TABS.map((tab) => (
          <FloatingTabBar key={tab} active={tab} position="static" badges={{ play: true }} />
        ))}
      </Section>

      <Section title="Splash" note="Shown once per session when the app is opened from the home screen. Add ?splash=1 to any URL to see the real one; the spinner appears after 1 second.">
        <Splash title="Deutsch mit Buddy" preview />
      </Section>

      <Section title="States: Skeleton, EmptyState, ErrorState, Toast">
        <div className="flex flex-col gap-3">
          <Skeleton label="" height={96} radius={28} />
          <Skeleton height={20} width="60%" />
          <Skeleton height={20} width="40%" />
        </div>
        <EmptyState pose="resting" message="Nothing due. Enjoy your day!" action={{ label: "Browse deck", href: "/cards" }} />
        <ErrorDemo />
        <ToastDemo />
      </Section>
    </main>
  );
}
