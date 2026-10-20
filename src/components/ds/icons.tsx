import type { SVGProps } from "react";

// 24px grid, 2px stroke, round caps and joins, currentColor (docs/DESIGN_BRIEF.md "Icons").
// Paw is filled (streak, combo); bone is outline (treats). All are decorative: put the label on the button.

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
}

function Svg({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PawIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
    <ellipse cx="5.5" cy="11" rx="2" ry="2.6" />
    <ellipse cx="9.5" cy="6.4" rx="2" ry="2.7" />
    <ellipse cx="14.5" cy="6.4" rx="2" ry="2.7" />
    <ellipse cx="18.5" cy="11" rx="2" ry="2.6" />
    <path d="M12 11.5c-3.2 0-6 3-6 5.6 0 1.9 1.7 2.6 3.6 2.2 1.5-.3 3.3-.3 4.8 0 1.9.4 3.6-.3 3.6-2.2 0-2.6-2.8-5.6-6-5.6z" />
  </svg>
);

export const BoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 15l6-6" />
    <circle cx="6.5" cy="14" r="2.2" />
    <circle cx="10" cy="17.5" r="2.2" />
    <circle cx="14" cy="6.5" r="2.2" />
    <circle cx="17.5" cy="10" r="2.2" />
  </Svg>
);

export const SpeakerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11 5L6 9H3v6h3l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 11l9-7.5 9 7.5" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M10 20v-6h4v6" />
  </Svg>
);

export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5z" />
    <path d="M12 6.5v13" />
  </Svg>
);

export const CardsIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="8" y="3.5" width="12" height="15" rx="2.5" />
    <path d="M5.5 7.5A2.5 2.5 0 0 0 4 9.8V19a2 2 0 0 0 2 2h8.2a2.5 2.5 0 0 0 2.3-1.5" />
  </Svg>
);

export const GameIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="9" cy="9" r=".6" fill="currentColor" />
    <circle cx="15" cy="9" r=".6" fill="currentColor" />
    <circle cx="9" cy="15" r=".6" fill="currentColor" />
    <circle cx="15" cy="15" r=".6" fill="currentColor" />
  </Svg>
);

export const UserIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c.8-3.8 3.7-5.5 7.5-5.5s6.7 1.7 7.5 5.5" />
  </Svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const EyeOffIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.9 5.7A10 10 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3 3.7M6.3 7.3A17 17 0 0 0 2 12s3.6 6.5 10 6.5c1.5 0 2.8-.3 4-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M3 3l18 18" />
  </Svg>
);

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5" />
    <circle cx="12" cy="16.3" r=".6" fill="currentColor" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.3l2.8 2.8L16.3 9.5" />
  </Svg>
);

export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.7" r=".6" fill="currentColor" />
  </Svg>
);

export const SpinnerIcon = ({ size = 24, className = "", ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
    className={`animate-spin ${className}`}
    {...rest}
  >
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);
