import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import messages from "../messages/en.json";

const withIntl = (ui: ReactElement) => (
  <NextIntlClientProvider locale="en" messages={messages}>
    {ui}
  </NextIntlClientProvider>
);

/** Renders a component with the English messages, as the app does. `rerender` keeps the provider. */
export function renderWithIntl(ui: ReactElement) {
  const result = render(withIntl(ui));
  return { ...result, rerender: (next: ReactElement) => result.rerender(withIntl(next)) };
}
