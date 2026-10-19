import { getRequestConfig } from "next-intl/server";

// English only for now. Add locales here (and a messages/<locale>.json) later.
export default getRequestConfig(async () => {
  const locale = "en";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
