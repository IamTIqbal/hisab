// Stroke icons drawn for the nav. 24×24, currentColor, 1.8 stroke.
type P = { className?: string };
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24', 'aria-hidden': true };

export const IconHome = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" /></svg>
);
export const IconOut = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 4v12M7 11l5 5 5-5" /><path d="M5 20h14" /></svg>
);
export const IconIn = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></svg>
);
export const IconPlus = ({ className }: P) => (
  <svg {...base} strokeWidth={2.4} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconMore = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 7h16M4 12h16M4 17h10" /></svg>
);
export const IconChevron = ({ className, dir = 'right' }: P & { dir?: 'left' | 'right' }) => (
  <svg {...base} strokeWidth={2} className={className} style={dir === 'left' ? { transform: 'scaleX(-1)' } : undefined}><path d="m9 6 6 6-6 6" /></svg>
);
export const IconSwap = ({ className }: P) => (
  <svg {...base} className={className}><path d="M7 4 4 7l3 3M4 7h13M17 20l3-3-3-3M20 17H7" /></svg>
);
