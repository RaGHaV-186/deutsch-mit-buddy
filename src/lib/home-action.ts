/**
 * What the big button on Home does. Published lessons can be read on the Learn tab (slice 3), so Continue leads there; the lesson player
 * (Buddy teaching in chat) arrives in slice 4. Set to false to send the button to the due queue (/cards) instead.
 */
export const LESSON_CONTENT_AVAILABLE = true;

export interface HomeAction {
  href: string;
  /** Message key under "Home". */
  label: "continue" | "reviewCards";
}

export function homeAction(lessonContent: boolean = LESSON_CONTENT_AVAILABLE): HomeAction {
  return lessonContent ? { href: "/learn", label: "continue" } : { href: "/cards", label: "reviewCards" };
}
