import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Inline stroke icons: no icon font or package, and they inherit the text colour. */
function Icon({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      {...props}
    >
      {children}
    </svg>
  );
}

const icon = (d: string, strokeWidth?: number) =>
  function PathIcon(props: IconProps) {
    return (
      <Icon strokeWidth={strokeWidth} {...props}>
        <path d={d} />
      </Icon>
    );
  };

export const CheckIcon = icon("M20 6 9 17l-5-5", 2.5);
export const AlertIcon = icon("M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18ZM12 8v5M12 16h.01");
export const InfoIcon = icon("M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18ZM12 11v5M12 8h.01");
export const LinkIcon = icon("M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5");
export const MoreIcon = icon("M5 12h.01M12 12h.01M19 12h.01", 2.5);
export const DocumentIcon = icon("M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 8h8M8 12h8M8 16h4", 1.75);
/** The product mark. Also drawn into the favicon and home-screen icon (src/components/app-icon.tsx). */
export const LOGO_PATH = "M6 8h12M6 12h8M6 16h5";
export const LogoIcon = icon(LOGO_PATH, 2.5);
export const ChevronLeftIcon = icon("M15 18l-6-6 6-6");
export const ChevronUpIcon = icon("M18 15l-6-6-6 6");
export const ChevronDownIcon = icon("M6 9l6 6 6-6");
export const PlusIcon = icon("M12 5v14M5 12h14");
export const XIcon = icon("M18 6 6 18M6 6l12 12");
export const TrashIcon = icon("M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6");
export const EyeIcon = icon("M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z", 1.75);
export const ExternalIcon = icon("M7 17 17 7M8 7h9v9");
export const LockIcon = icon("M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5Z");
export const SearchIcon = icon("M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14ZM20 20l-4-4");
export const HistoryIcon = icon("M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2");
export const OfflineIcon = icon(
  "M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M5 12.86a10 10 0 0 1 5.17-2.69M16.85 11.25a10 10 0 0 1 2.22 1.68M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M2 2l20 20",
);
export const ChartIcon = icon("M4 20V10M10 20V4M16 20v-7M22 20H2");
export const PencilIcon = icon("M4 20h4L19 9l-4-4L4 16ZM13.5 6.5l4 4");
export const LogOutIcon = icon("M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11");
export const RetryIcon = icon("M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5");
export const ArrowUpIcon = icon("M12 19V5M5 12l7-7 7 7");
export const ArrowDownIcon = icon("M12 5v14M19 12l-7 7-7-7");
export const GripIcon = icon("M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01", 3);
export const BranchIcon = icon("M6 3v12M18 9a3 3 0 1 0 0-6a3 3 0 1 0 0 6ZM6 21a3 3 0 1 0 0-6a3 3 0 1 0 0 6ZM18 9a9 9 0 0 1-9 9");

/** Question type icons, keyed by QuestionType. */
export const TextTypeIcon = icon("M4 6h16M4 12h16M4 18h10");
export const SingleTypeIcon = icon("M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18ZM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z");
export const MultiTypeIcon = icon("M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 12l3 3 5-6");
export const RatingTypeIcon = icon("M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z");

export function SpinnerIcon({ size = 16, ...props }: IconProps) {
  return (
    <Icon size={size} strokeWidth={2.5} {...props} className="shrink-0 animate-spin">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Icon>
  );
}
