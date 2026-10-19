import type { ErrorEvent } from "@sentry/nextjs";

/** Removes anything personal before an error report leaves the app: cookies, headers, IP, email, query strings. */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
  }
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  return event;
}
