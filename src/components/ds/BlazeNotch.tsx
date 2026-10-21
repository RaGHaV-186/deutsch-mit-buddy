/**
 * The narrow wedge rising into a grey block, like the white stripe on Buddy's face.
 * `fill` must be the colour of the area beyond the block: var(--bg) on the page, var(--surface) inside a card.
 * `edge="right"` is the desktop auth panel: the wedge points left from the panel's right edge into the form.
 */
export function BlazeNotch({
  fill = "var(--bg)",
  small = false,
  edge = "bottom",
  className = "block",
}: {
  fill?: string;
  small?: boolean;
  edge?: "bottom" | "right";
  /** Replaces the default "block", e.g. "hidden desk:block" to show it only on desktop. */
  className?: string;
}) {
  if (edge === "right") {
    return (
      <svg
        width={30}
        height={48}
        viewBox="0 0 30 48"
        aria-hidden="true"
        focusable="false"
        className={className}
        style={{ position: "absolute", right: -1, top: "50%", marginTop: -24 }}
      >
        <polygon points="0,21 0,27 30,48 30,0" fill={fill} />
      </svg>
    );
  }
  const [w, h, points] = small ? [40, 24, "17.5,0 22.5,0 40,24 0,24"] : [48, 30, "21,0 27,0 48,30 0,30"];
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ position: "absolute", bottom: -1, left: "50%", marginLeft: -w / 2 }}
    >
      <polygon points={points} fill={fill} />
    </svg>
  );
}
