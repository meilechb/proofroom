import type { SVGProps } from "react";

/** Inline icons, 24-unit grid, stroke inherits currentColor (plan 4.14). */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  );
}

export const Icon = {
  Home: (p: IconProps) => <Svg {...p}><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /></Svg>,
  Inbox: (p: IconProps) => <Svg {...p}><path d="M4 4h16v16H4z" /><path d="M4 14h5l2 3h2l2-3h5" /></Svg>,
  Users: (p: IconProps) => <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.5a5 5 0 0 1 5.5 5.5" /></Svg>,
  Calendar: (p: IconProps) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>,
  Camera: (p: IconProps) => <Svg {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Svg>,
  Image: (p: IconProps) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></Svg>,
  Globe: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></Svg>,
  Mail: (p: IconProps) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>,
  Settings: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.1a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.1a1 1 0 0 0-.9.6z" /></Svg>,
  Gift: (p: IconProps) => <Svg {...p}><rect x="3" y="8" width="18" height="5" /><path d="M5 13v8h14v-8M12 8v13M12 8a3 3 0 1 1 3-3c0 2-3 3-3 3zm0 0a3 3 0 1 0-3-3c0 2 3 3 3 3z" /></Svg>,
  Upload: (p: IconProps) => <Svg {...p}><path d="M12 16V4m0 0-4 4m4-4 4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></Svg>,
  Download: (p: IconProps) => <Svg {...p}><path d="M12 4v12m0 0-4-4m4 4 4-4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></Svg>,
  Heart: (p: IconProps) => <Svg {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></Svg>,
  HeartFilled: (p: IconProps) => <Svg {...p} fill="currentColor"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></Svg>,
  Message: (p: IconProps) => <Svg {...p}><path d="M4 5h16v11H9l-5 4z" /></Svg>,
  Check: (p: IconProps) => <Svg {...p}><path d="m5 12 5 5L20 7" /></Svg>,
  X: (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>,
  Plus: (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>,
  ChevronDown: (p: IconProps) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>,
  ChevronLeft: (p: IconProps) => <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>,
  ChevronRight: (p: IconProps) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>,
  Search: (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></Svg>,
  Trash: (p: IconProps) => <Svg {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></Svg>,
  Edit: (p: IconProps) => <Svg {...p}><path d="m4 20 4-1L19 8l-3-3L5 16z" /></Svg>,
  Link: (p: IconProps) => <Svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>,
  External: (p: IconProps) => <Svg {...p}><path d="M14 4h6v6M20 4l-9 9" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></Svg>,
  Menu: (p: IconProps) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>,
  Dots: (p: IconProps) => <Svg {...p} fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></Svg>,
  Alert: (p: IconProps) => <Svg {...p}><path d="M12 3 2 21h20z" /><path d="M12 10v5M12 18h.01" /></Svg>,
  Info: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></Svg>,
  Play: (p: IconProps) => <Svg {...p} fill="currentColor" stroke="none"><path d="M7 4v16l13-8z" /></Svg>,
  Expand: (p: IconProps) => <Svg {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Svg>,
  Grid: (p: IconProps) => <Svg {...p}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></Svg>,
  List: (p: IconProps) => <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>,
  Share: (p: IconProps) => <Svg {...p}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" /></Svg>,
  Lock: (p: IconProps) => <Svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>,
  Lightroom: (p: IconProps) => <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 8v8h4M14 12h3" /></Svg>,
  Card: (p: IconProps) => <Svg {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h3" /></Svg>,
  Clock: (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>,
  Folder: (p: IconProps) => <Svg {...p}><path d="M3 7h6l2 2h10v10H3z" /></Svg>,
  Star: (p: IconProps) => <Svg {...p}><path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4 6.4 20.3l1.1-6.2L3 9.7l6.2-.9z" /></Svg>,
};

export type IconName = keyof typeof Icon;
