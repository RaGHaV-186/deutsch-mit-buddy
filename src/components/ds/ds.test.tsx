import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test-utils";
import {
  ArticleWord,
  BlazeNotch,
  BuddyMascot,
  BUDDY_POSES,
  CheckboxField,
  CodeInput,
  CoatHeader,
  Divider,
  PasswordStrength,
  SelectField,
  StickyActions,
  strengthOf,
  Cushion,
  DueCardsTile,
  EmptyState,
  ErrorState,
  FloatingTabBar,
  LevelCard,
  PasswordField,
  PawStreakWeek,
  PillButton,
  Skeleton,
  SpeechBubble,
  TextField,
  Toast,
  TreatChip,
  WedgeProgress,
} from ".";

afterEach(() => vi.useRealTimers());

describe("BlazeNotch and CoatHeader", () => {
  it("draws the notch polygon from the brief, in the colour of the area below", () => {
    const { container } = render(<BlazeNotch fill="var(--surface)" />);
    const poly = container.querySelector("polygon")!;
    expect(poly).toHaveAttribute("points", "21,0 27,0 48,30 0,30");
    expect(poly).toHaveAttribute("fill", "var(--surface)");
    expect(container.querySelector("svg")).toHaveAttribute("width", "48");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("small variant is 40 x 24", () => {
    const { container } = render(<BlazeNotch small />);
    expect(container.querySelector("polygon")).toHaveAttribute("points", "17.5,0 22.5,0 40,24 0,24");
    expect(container.querySelector("svg")).toHaveAttribute("height", "24");
  });

  it("coat block: rounded only at the bottom, safe-area padding, contains its content and the notch", () => {
    const { container } = render(
      <CoatHeader>
        <h1>Hallo</h1>
      </CoatHeader>,
    );
    const header = container.querySelector("header")!;
    expect(header.className).toContain("rounded-coat");
    expect(header.className).toContain("bg-coat");
    expect(header.style.paddingTop).toContain("safe-area-inset-top");
    expect(header.style.paddingBottom).toBe("44px");
    expect(screen.getByRole("heading", { name: "Hallo" })).toBeInTheDocument();
    expect(container.querySelector("polygon")).not.toBeNull();
  });

  it("compact variant has less bottom padding", () => {
    const { container } = render(<CoatHeader compact>x</CoatHeader>);
    expect(container.querySelector("header")!.style.paddingBottom).toBe("36px");
  });
});

describe("WedgeProgress", () => {
  it("is a progressbar with aria values, clamped to 0 to 100", () => {
    const { rerender } = render(<WedgeProgress value={0.356} label="Level" />);
    const bar = screen.getByRole("progressbar", { name: "Level" });
    expect(bar).toHaveAttribute("aria-valuenow", "36");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    rerender(<WedgeProgress value={4} label="Level" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    rerender(<WedgeProgress value={-1} label="Level" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    rerender(<WedgeProgress value={Number.NaN} label="Level" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("uses the wedge clip-path, --progress on the page and light-on-coat on the coat block", () => {
    const { container, rerender } = render(<WedgeProgress value={0.5} label="p" />);
    const track = container.querySelector('[style*="clip-path"]') as HTMLElement;
    expect(track.style.clipPath).toBe("polygon(0 36%, 100% 0, 100% 100%, 0 64%)");
    expect(track.className).toContain("bg-track");
    expect(track.firstElementChild!.className).toContain("bg-progress");
    expect((track.firstElementChild as HTMLElement).style.width).toBe("50%");
    rerender(<WedgeProgress value={0.5} onCoat label="p" />);
    const onCoat = container.querySelector('[style*="clip-path"]') as HTMLElement;
    expect(onCoat.className).toContain("bg-coat-track");
    expect(onCoat.firstElementChild!.className).toContain("bg-on-coat");
  });

  it("optional paw marker at the end of the fill", () => {
    const { container } = render(<WedgeProgress value={0.8} marker label="p" />);
    const marker = container.querySelector("span[aria-hidden]") as HTMLElement;
    expect(marker.style.left).toBe("80%");
    expect(marker.querySelector("svg")).not.toBeNull();
  });
});

describe("Cushion", () => {
  it("is a plain box by default, a link with href and a button with onClick", () => {
    const onClick = vi.fn();
    const { rerender } = render(<Cushion>plain</Cushion>);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<Cushion href="/cards">link</Cushion>);
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute("href", "/cards");
    rerender(<Cushion onClick={onClick}>button</Cushion>);
    fireEvent.click(screen.getByRole("button", { name: "button" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("has the cushion shadow, a radius prop, and a press state on interactive ones", () => {
    const { container, rerender } = render(<Cushion radius={32}>x</Cushion>);
    expect((container.firstChild as HTMLElement).style.borderRadius).toBe("32px");
    expect((container.firstChild as HTMLElement).className).toContain("shadow-cushion");
    rerender(<Cushion href="/x">x</Cushion>);
    expect(screen.getByRole("link").className).toContain("ds-press");
  });

  it("a disabled button cannot be clicked", () => {
    const onClick = vi.fn();
    render(
      <Cushion onClick={onClick} disabled>
        x
      </Cushion>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("PillButton", () => {
  it("variants map to the brief's colours", () => {
    const cases: [Parameters<typeof PillButton>[0]["variant"], string][] = [
      ["blaze", "bg-blaze"],
      ["coat", "bg-coat"],
      ["cushion", "shadow-cushion"],
      ["outline-on-coat", "border-on-coat-muted"],
      ["ghost", "bg-transparent"],
    ];
    for (const [variant, cls] of cases) {
      const { unmount } = render(<PillButton variant={variant}>{variant}</PillButton>);
      expect(screen.getByRole("button", { name: variant! }).className).toContain(cls);
      unmount();
    }
  });

  it("is fully rounded and sizes to 44 / 56 / 60", () => {
    render(
      <>
        <PillButton size={44}>a</PillButton>
        <PillButton>b</PillButton>
        <PillButton size={60}>c</PillButton>
      </>,
    );
    expect(screen.getByRole("button", { name: "a" }).className).toContain("h-11");
    expect(screen.getByRole("button", { name: "b" }).className).toContain("h-14");
    expect(screen.getByRole("button", { name: "c" }).className).toContain("h-[60px]");
    expect(screen.getByRole("button", { name: "b" }).className).toContain("rounded-full");
  });

  it("loading: disabled, busy, shows a spinner, keeps the label's width and ignores clicks", () => {
    const onClick = vi.fn();
    const { container } = render(
      <PillButton loading onClick={onClick}>
        Sign in
      </PillButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector("svg.animate-spin")).not.toBeNull();
    expect(screen.getByText("Sign in").className).toContain("invisible"); // still takes up its space
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disabled cannot be clicked; a link variant renders an anchor", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <PillButton disabled onClick={onClick}>
        x
      </PillButton>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
    rerender(<PillButton href="/home">Home</PillButton>);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/home");
  });

  it("buttons on the coat block get a light focus ring; type defaults to button", () => {
    render(<PillButton variant="blaze">x</PillButton>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("[--ring:var(--on-coat)]");
    expect(button).toHaveAttribute("type", "button");
  });
});

describe("TextField and PasswordField", () => {
  it("connects the label and the input", () => {
    render(<TextField label="Email" type="email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  });

  it("error: invalid, described by the message (an alert with an icon), no hint", () => {
    const { container } = render(<TextField label="Email" error="Please enter a valid email." hint="ignored" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Please enter a valid email.");
    expect(alert).not.toHaveTextContent("ignored");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(input.className).toContain("var(--die)");
  });

  it("hint: described, not an alert", () => {
    render(<TextField label="Email" hint="We never share it." />);
    expect(screen.queryByRole("alert")).toBeNull();
    const input = screen.getByLabelText("Email");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveTextContent("We never share it.");
  });

  it("has 56px height, 16px text (no iOS zoom), and passes input props through", () => {
    render(<TextField label="Name" disabled defaultValue="x" autoComplete="name" />);
    const input = screen.getByLabelText("Name");
    expect(input.className).toContain("h-14");
    expect(input.className).toContain("text-[16px]");
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("autocomplete", "name");
  });

  it("password: show/hide toggles the type, with an accessible name and pressed state", () => {
    renderWithIntl(<PasswordField label="Password" autoComplete="current-password" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(hide);
    expect(input).toHaveAttribute("type", "password");
  });
});

describe("CodeInput", () => {
  const boxes = () => screen.getAllByRole("textbox") as HTMLInputElement[];
  const type = (i: number, v: string) => fireEvent.change(boxes()[i], { target: { value: v } });
  const code = () => boxes().map((b) => b.value).join("");

  it("six numeric boxes; only the first offers one-time-code autofill", () => {
    renderWithIntl(<CodeInput />);
    expect(boxes()).toHaveLength(6);
    expect(screen.getByRole("group", { name: "6-digit code" })).toBeInTheDocument();
    boxes().forEach((b, i) => {
      expect(b).toHaveAttribute("inputmode", "numeric");
      expect(b).toHaveAttribute("autocomplete", i === 0 ? "one-time-code" : "off");
      expect(b).toHaveAccessibleName(`Digit ${i + 1} of 6`);
    });
  });

  it("typing a digit moves to the next box", () => {
    renderWithIntl(<CodeInput />);
    boxes()[0].focus();
    type(0, "4");
    expect(document.activeElement).toBe(boxes()[1]);
    type(1, "8");
    expect(code()).toBe("48");
    expect(document.activeElement).toBe(boxes()[2]);
  });

  it("ignores letters and symbols", () => {
    renderWithIntl(<CodeInput />);
    type(0, "a");
    type(0, "-");
    expect(code()).toBe("");
  });

  it("backspace in an empty box clears and focuses the previous one", () => {
    renderWithIntl(<CodeInput />);
    type(0, "4");
    type(1, "8");
    boxes()[2].focus();
    fireEvent.keyDown(boxes()[2], { key: "Backspace" });
    expect(code()).toBe("4");
    expect(document.activeElement).toBe(boxes()[1]);
  });

  it("arrow keys move between boxes", () => {
    renderWithIntl(<CodeInput />);
    boxes()[2].focus();
    fireEvent.keyDown(boxes()[2], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(boxes()[1]);
    fireEvent.keyDown(boxes()[1], { key: "ArrowRight" });
    expect(document.activeElement).toBe(boxes()[2]);
  });

  it("pasting a 6-digit code fills every box and completes once", () => {
    const onComplete = vi.fn();
    renderWithIntl(<CodeInput onComplete={onComplete} />);
    fireEvent.paste(boxes()[3], { clipboardData: { getData: () => " 482 915 " } });
    expect(code()).toBe("482915");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("482915");
  });

  it("autofill (a whole code arriving in the first box) fills every box", () => {
    const onComplete = vi.fn();
    renderWithIntl(<CodeInput onComplete={onComplete} />);
    type(0, "123456");
    expect(code()).toBe("123456");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("completes when the last digit is typed, and not before", () => {
    const onComplete = vi.fn();
    renderWithIntl(<CodeInput onComplete={onComplete} />);
    "12345".split("").forEach((d, i) => type(i, d));
    expect(onComplete).not.toHaveBeenCalled();
    type(5, "6");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("can be controlled, and reports changes", () => {
    const onChange = vi.fn();
    renderWithIntl(<CodeInput value="12" onChange={onChange} />);
    expect(code()).toBe("12");
    type(2, "3");
    expect(onChange).toHaveBeenLastCalledWith("123");
  });

  it("adds a hidden input so it works inside a form", () => {
    const { container } = renderWithIntl(<CodeInput name="code" value="123" />);
    expect(container.querySelector('input[type="hidden"][name="code"]')).toHaveValue("123");
  });

  it("error: red rings, invalid, and a shake that can be replayed", () => {
    const { container, rerender } = renderWithIntl(<CodeInput value="000000" error errorKey={1} />);
    expect(boxes()[0]).toHaveAttribute("aria-invalid", "true");
    expect(boxes()[0].className).toContain("ring-die");
    const group = container.querySelector('[role="group"]')!;
    expect(group.className).toContain("ds-shake");
    rerender(<CodeInput value="000000" error errorKey={2} />);
    expect(container.querySelector('[role="group"]')).not.toBe(group); // new element restarts the animation
  });

  it("disabled boxes cannot be edited", () => {
    renderWithIntl(<CodeInput disabled />);
    boxes().forEach((b) => expect(b).toBeDisabled());
  });
});

describe("TreatChip and SpeechBubble", () => {
  it("treat chip uses the belly-pink tint", () => {
    render(<TreatChip>+50 treats</TreatChip>);
    expect(screen.getByText("+50 treats").className).toContain("bg-tint");
  });

  it("speech bubble wraps German in „…“ and has the two looks", () => {
    const { rerender } = render(<SpeechBubble>Guten Tag!</SpeechBubble>);
    expect(screen.getByText("„Guten Tag!“").className).toContain("bg-bubble");
    expect(screen.getByText("„Guten Tag!“").className).toContain("16px_16px_16px_4px");
    rerender(
      <SpeechBubble onSurface quoted={false}>
        Hello
      </SpeechBubble>,
    );
    expect(screen.getByText("Hello").className).toContain("bg-surface");
  });
});

describe("FloatingTabBar", () => {
  it("five tabs, the active one labelled and marked current; the others icon-only with an accessible name", () => {
    renderWithIntl(<FloatingTabBar active="cards" />);
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/home", "/learn", "/cards", "/play", "/me"]);
    const active = screen.getByRole("link", { name: "Cards" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.className).toContain("bg-tint");
    expect(active).toHaveTextContent("Cards");
    const home = screen.getByRole("link", { name: "Home" });
    expect(home).not.toHaveAttribute("aria-current");
    expect(home).not.toHaveTextContent("Home"); // icon only
  });

  it("every tab can be the active one", () => {
    for (const [id, label] of [["home", "Home"], ["learn", "Learn"], ["play", "Play"], ["me", "Me"]] as const) {
      const { unmount } = renderWithIntl(<FloatingTabBar active={id} />);
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
      unmount();
    }
  });

  it("badge dot on an inactive tab, announced, in the progress colour", () => {
    renderWithIntl(<FloatingTabBar active="home" badges={{ play: true }} />);
    const dot = screen.getByRole("img", { name: "New activity" });
    expect(dot.className).toContain("bg-progress");
    expect(screen.getByRole("link", { name: /Play/ })).toContainElement(dot);
  });

  it("is fixed to the bottom with safe-area padding, or static for showcases", () => {
    const { container, rerender } = renderWithIntl(<FloatingTabBar active="home" />);
    expect((container.firstChild as HTMLElement).className).toContain("fixed");
    expect((container.firstChild as HTMLElement).style.paddingBottom).toContain("safe-area-inset-bottom");
    rerender(<FloatingTabBar active="home" position="static" />);
    expect((container.firstChild as HTMLElement).className).not.toContain("fixed");
  });
});

describe("PawStreakWeek", () => {
  const week = ["done", "today", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming"] as const;

  it("title, rest-day note and seven days Mo to So", () => {
    renderWithIntl(<PawStreakWeek streak={10} days={week} />);
    expect(screen.getByRole("heading", { name: "10-day streak" })).toBeInTheDocument();
    expect(screen.getByText("Sunday is a rest day")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    for (const d of ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]) expect(screen.getByText(d)).toBeInTheDocument();
  });

  it("done = progress fill, today = pink with a ring, others = track; each announced in words", () => {
    const { container } = renderWithIntl(<PawStreakWeek streak={1} days={["done", "today", "missed", "upcoming", "upcoming", "upcoming", "upcoming"]} />);
    const circles = [...container.querySelectorAll("li > span:first-child")];
    expect(circles[0].className).toContain("bg-progress");
    expect(circles[1].className).toContain("bg-tint");
    expect(circles[1].className).toContain("ring-progress");
    expect(circles[2].className).toContain("bg-track");
    expect(screen.getByText("Monday, done")).toHaveClass("sr-only");
    expect(screen.getByText("Tuesday, today, not done yet")).toBeInTheDocument();
    expect(screen.getByText("Wednesday, missed")).toBeInTheDocument();
  });
});

describe("LevelCard and DueCardsTile", () => {
  it("shows the level, formatted treats, the wedge bar and the treats to go", () => {
    renderWithIntl(<LevelCard level={3} treats={1240} nextAt={1500} />);
    expect(screen.getByRole("heading", { name: "Level 3" })).toBeInTheDocument();
    expect(screen.getByText("240 / 500")).toBeInTheDocument(); // next to the bar: progress inside this level
    expect(screen.getByText("1,240 treats")).toBeInTheDocument(); // the total, as a caption under the title
    expect(screen.getByText("260 treats to Level 4")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Progress to level 4" });
    expect(bar).toHaveAttribute("aria-valuenow", "48"); // 240 of the 500 treats of this level
  });

  it("never shows negative treats to go, or more than the level holds", () => {
    renderWithIntl(<LevelCard level={1} treats={600} nextAt={500} />);
    expect(screen.getByText("0 treats to Level 2")).toBeInTheDocument();
    expect(screen.getByText("500 / 500")).toBeInTheDocument();
  });

  it("the label and the bar always agree", () => {
    for (const [treats, label, now] of [[1000, "0 / 500", "0"], [1250, "250 / 500", "50"], [1499, "499 / 500", "100"]] as const) {
      const { unmount } = renderWithIntl(<LevelCard level={3} treats={treats} nextAt={1500} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", now);
      unmount();
    }
  });

  it("due tile links to the deck and pluralises", () => {
    const { rerender } = renderWithIntl(<DueCardsTile count={29} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/cards");
    expect(link).toHaveTextContent("29");
    expect(link).toHaveTextContent("cards due");
    expect(link).toHaveTextContent("Review");
    rerender(<DueCardsTile count={1} />);
    expect(screen.getByRole("link")).toHaveTextContent("card due");
  });
});

describe("ArticleWord", () => {
  const colorOf = (text: string) => (screen.getByText(text) as HTMLElement).style.color;

  it("colours the article by gender and leaves the noun in the text colour", () => {
    const { rerender } = render(<ArticleWord article="der" word="Kaffee" />);
    expect(colorOf("der")).toBe("var(--der)");
    expect(screen.getByText("Kaffee").className).toContain("text-text");
    rerender(<ArticleWord article="DIE" word="Stadt" />);
    expect(colorOf("DIE")).toBe("var(--die)");
    rerender(<ArticleWord article="das" word="Land" />);
    expect(colorOf("das")).toBe("var(--das)");
  });

  it("plural articles are muted; words without an article show just the word", () => {
    const { container, rerender } = render(<ArticleWord article="die" word="Kaffees" plural />);
    expect(colorOf("die")).toBe("var(--muted)");
    rerender(<ArticleWord article={null} word="heißen" />);
    expect(container).toHaveTextContent("heißen");
    expect(container.querySelector("[data-article]")).toBeNull();
  });
});

describe("BuddyMascot", () => {
  it("renders each pose from /buddy as decorative art", () => {
    for (const pose of BUDDY_POSES) {
      const { container, unmount } = render(<BuddyMascot pose={pose} size={100} />);
      const img = container.querySelector("img")!;
      expect(img.getAttribute("src")).toContain(`buddy-${pose}.svg`);
      expect(img).toHaveAttribute("alt", "");
      unmount();
    }
    expect(BUDDY_POSES).toEqual(["neutral", "talking", "curious", "happy", "resting", "listening"]);
  });
});

describe("states", () => {
  it("skeleton is hidden from screen readers, or announces Loading once when labelled", () => {
    const { container, rerender } = renderWithIntl(<Skeleton height={20} />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    expect((container.firstChild as HTMLElement).className).toContain("animate-pulse");
    rerender(<Skeleton label="" />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("empty state: Buddy, one line, one button", () => {
    const { container } = renderWithIntl(<EmptyState pose="resting" message="Nothing due." action={{ label: "Browse deck", href: "/cards" }} />);
    expect(container.querySelector("img")!.getAttribute("src")).toContain("buddy-resting");
    expect(screen.getByText("Nothing due.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse deck" })).toHaveAttribute("href", "/cards");
  });

  it("error state: curious Buddy, the message as an alert, Retry calls back", () => {
    const onRetry = vi.fn();
    const { container } = renderWithIntl(<ErrorState message="Couldn't load." onRetry={onRetry} />);
    expect(container.querySelector("img")!.getAttribute("src")).toContain("buddy-curious");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("toast: shows its message and dismisses itself after 3 seconds", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderWithIntl(<Toast open onClose={onClose}>Saved</Toast>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    act(() => vi.advanceTimersByTime(2900));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("toast: nothing when closed; errors are announced as alerts", () => {
    const { container, rerender } = renderWithIntl(<Toast open={false} onClose={() => {}}>x</Toast>);
    expect(container).toBeEmptyDOMElement();
    rerender(
      <Toast open kind="error" onClose={() => {}}>
        Failed
      </Toast>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
  });
});

describe("form parts", () => {
  it("strengthOf is a length hint: nothing, short under 10, fair under 14, strong from 14", () => {
    expect(["", "a", "123456789", "1234567890", "1234567890123", "12345678901234"].map(strengthOf)).toEqual([
      "empty",
      "short",
      "short",
      "fair",
      "fair",
      "strong",
    ]);
  });

  it("PasswordStrength shows a wedge meter with a text label, in the die / progress / das colours", () => {
    const { container, rerender } = renderWithIntl(<PasswordStrength password="" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<PasswordStrength password="short" />);
    expect(screen.getByText("Too short")).toBeInTheDocument();
    expect(container.querySelector(".bg-die")).not.toBeNull();
    rerender(<PasswordStrength password="twelve-chars" />);
    expect(screen.getByText("Okay")).toBeInTheDocument();
    expect(container.querySelector(".bg-progress")).not.toBeNull();
    rerender(<PasswordStrength password="a-much-longer-passphrase" />);
    expect(screen.getByText("Strong")).toBeInTheDocument();
    expect(container.querySelector(".bg-das")).not.toBeNull();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("SelectField: labelled 56px native select with its options", () => {
    render(
      <SelectField label="Starting lesson" name="seq" defaultValue="2">
        <option value="1">Z1</option>
        <option value="2">Z2</option>
      </SelectField>,
    );
    const select = screen.getByLabelText("Starting lesson") as HTMLSelectElement;
    expect(select.value).toBe("2");
    expect(select.className).toContain("h-14");
    expect(select).toHaveAttribute("name", "seq");
  });

  it("CheckboxField: a real checkbox, named by its text (which may hold links), required passes through, 44px tap area", () => {
    render(
      <CheckboxField name="terms" required>
        <span>
          Accept the <a href="/terms">Terms</a>
        </span>
      </CheckboxField>,
    );
    const box = screen.getByRole("checkbox", { name: "Accept the Terms" });
    expect(box).toBeRequired();
    expect(box).toHaveAttribute("name", "terms");
    expect(box.closest("label")!.className).toContain("w-11");
    fireEvent.click(box);
    expect(box).toBeChecked();
  });

  it("Divider is a separator with its word; StickyActions pins its children to the bottom of the screen", () => {
    const { container } = render(
      <>
        <Divider>or</Divider>
        <StickyActions>
          <button>Go</button>
        </StickyActions>
      </>,
    );
    expect(screen.getByRole("separator")).toHaveTextContent("or");
    const sticky = screen.getByRole("button", { name: "Go" }).parentElement!;
    expect(sticky.className).toContain("sticky");
    expect(sticky.className).toContain("bottom-0");
    expect(sticky.className).toContain("safe-area-inset-bottom");
    expect(container).toBeTruthy();
  });
});
