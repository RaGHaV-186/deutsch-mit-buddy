/**
 * The narrow white wedge rising into a grey block, like the white stripe on Buddy's face.
 * `fill` must be the colour of the area below the block: var(--bg) on the page, var(--surface) inside a card.
 */
export function BlazeNotch({ fill = "var(--bg)", small = false }: { fill?: string; small?: boolean }) {
  const [w, h, points] = small ? [40, 24, "17.5,0 22.5,0 40,24 0,24"] : [48, 30, "21,0 27,0 48,30 0,30"];
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", bottom: -1, left: "50%", marginLeft: -w / 2, display: "block" }}
    >
      <polygon points={points} fill={fill} />
    </svg>
  );
}
