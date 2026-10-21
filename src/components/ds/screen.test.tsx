import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Screen } from "./Screen";

describe("Screen", () => {
  it("is the page's main landmark", () => {
    render(<Screen>content</Screen>);
    expect(screen.getByRole("main")).toHaveTextContent("content");
  });

  it('as="div" is not a landmark, for screens that draw their own <main>', () => {
    render(
      <Screen as="div">
        <main>inner</main>
      </Screen>,
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});
