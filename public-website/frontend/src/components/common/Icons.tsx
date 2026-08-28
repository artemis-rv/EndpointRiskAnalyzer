/**
 * components/common/Icons.tsx
 * ───────────────────────────
 * Inline SVG icons.
 *
 * Deliberately hand-rolled rather than pulled from an icon package: it keeps the
 * dependency surface small and guarantees no icon is fetched from a third-party
 * origin at runtime (OWASP A08).
 *
 * Every icon is `aria-hidden` and `focusable="false"`. Icons never carry meaning
 * on their own — the accessible name always comes from adjacent text or the
 * control's own aria-label.
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l7 2.6v5.2c0 4.3-2.9 8.2-7 9.4-4.1-1.2-7-5.1-7-9.4V5.6L12 3z" />
    <path d="M9.2 12.1l2 2 3.6-4" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11" />
    <path d="M7.5 10.5L12 15l4.5-4.5" />
    <path d="M5 19h14" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.3l2.4 2.4 4.6-4.9" />
  </Icon>
);

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5" />
    <path d="M12 16.3h.01" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <path d="M12 7.7h.01" />
  </Icon>
);

export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 6l6 6-6 6" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 6l-6 6 6 6" />
  </Icon>
);

export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 012-2h9" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19.5c1.2-3.2 3.9-4.8 7-4.8s5.8 1.6 7 4.8" />
  </Icon>
);

export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9.5" cy="8.5" r="3" />
    <path d="M3.5 19c1-2.7 3.3-4.1 6-4.1s5 1.4 6 4.1" />
    <path d="M16.5 6.2a3 3 0 010 5.6" />
    <path d="M18 14.9c2 .5 3.4 1.9 4.1 3.9" />
  </Icon>
);

export const PackageIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5l8 4v9l-8 4-8-4v-9l8-4z" />
    <path d="M4 7.5l8 4 8-4" />
    <path d="M12 11.5v9" />
  </Icon>
);

export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 12.5c0 3.6-3.6 6.5-8 6.5a9.6 9.6 0 01-2.6-.35L5 20.5l1.2-3.1A6.4 6.4 0 014 12.5C4 8.9 7.6 6 12 6s8 2.9 8 6.5z" />
  </Icon>
);

export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="M3.8 7l8.2 6 8.2-6" />
  </Icon>
);

export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V9" />
    <path d="M10 20V4" />
    <path d="M16 20v-7" />
    <path d="M22 20H2" />
  </Icon>
);

export const DashboardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </Icon>
);

export const BookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4.5h9a3 3 0 013 3v12H8a3 3 0 00-3 3v-18z" />
    <path d="M5 19.5h12" />
  </Icon>
);

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 5.5H6.5A1.5 1.5 0 005 7v10a1.5 1.5 0 001.5 1.5H14" />
    <path d="M17 15l3-3-3-3" />
    <path d="M20 12h-9" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Icon>
);

export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 4.5l2.3 4.7 5.2.75-3.75 3.65.9 5.15L12 16.3l-4.65 2.45.9-5.15L4.5 9.95l5.2-.75L12 4.5z" />
  </Icon>
);

export const InboxIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 13.5V7a2 2 0 012-2h12a2 2 0 012 2v6.5" />
    <path d="M4 13.5h4l1.5 2.5h5L16 13.5h4v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4z" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 7h15" />
    <path d="M9.5 7V5.5A1.5 1.5 0 0111 4h2a1.5 1.5 0 011.5 1.5V7" />
    <path d="M6.5 7l.8 11.2A2 2 0 009.3 20h5.4a2 2 0 002-1.8L17.5 7" />
  </Icon>
);

export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 19.5h4l10-10a2.1 2.1 0 00-3-3l-10 10v3z" />
    <path d="M14.5 6.5l3 3" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5.5v13" />
    <path d="M5.5 12h13" />
  </Icon>
);

export const ExternalIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 5h5v5" />
    <path d="M19 5l-7.5 7.5" />
    <path d="M18 14v4.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10" />
  </Icon>
);
