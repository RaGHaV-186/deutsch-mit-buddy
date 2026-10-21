import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test-utils";
import { BottomSheet, SegmentedControl, TreatFloat } from ".";

describe("BottomSheet", () => {
  it("renders nothing while closed; open it is a modal dialog with a title, a Close button and moves focus into itself", () => {
    const { rerender } = renderWithIntl(
      <BottomSheet open={false} onClose={() => {}} title="Options">
        <button>inside</button>
      </BottomSheet>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <BottomSheet open onClose={() => {}} title="Options">
        <button>inside</button>
      </BottomSheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Options" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(document.activeElement).toBe(dialog);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("closes with the Close button, the dim area and Escape", () => {
    const onClose = vi.fn();
    renderWithIntl(
      <BottomSheet open onClose={onClose} title="Options">
        x
      </BottomSheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Close options" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("SegmentedControl", () => {
  it("is a radio group; the chosen option is filled with --progress and choosing calls back", () => {
    const onChange = vi.fn();
    renderWithIntl(<SegmentedControl label="Mode" value="a" options={["a", "b"] as const} onChange={onChange} text={(v) => v.toUpperCase()} />);
    expect(screen.getByRole("radiogroup", { name: "Mode" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "A" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "A" }).className).toContain("bg-progress");
    fireEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("TreatFloat", () => {
  it("is an announced chip that floats up", () => {
    renderWithIntl(<TreatFloat>+10 treats</TreatFloat>);
    const chip = screen.getByRole("status");
    expect(chip).toHaveTextContent("+10 treats");
    expect(chip.className).toContain("ds-float-up");
  });
});
