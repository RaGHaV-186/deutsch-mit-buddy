/**
 * What the big button on Home does. Lessons (Buddy teaching in chat) arrive in slice 4; until then the lesson has no content,
 * so the button leads to today's cards instead of a "coming soon" page. Cards are not linked to a lesson deck screen yet,
 * so it goes to the whole due queue (/cards).
 */
export const LESSON_CONTENT_AVAILABLE = false;

export interface HomeAction {
  href: string;
  /** Message key under "Home". */
  label: "continue" | "reviewCards";
}

export function homeAction(lessonContent: boolean = LESSON_CONTENT_AVAILABLE): HomeAction {
  return lessonContent ? { href: "/learn", label: "continue" } : { href: "/cards", label: "reviewCards" };
}
