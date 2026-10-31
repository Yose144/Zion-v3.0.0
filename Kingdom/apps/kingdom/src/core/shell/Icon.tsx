type IconName = 'link' | 'anvil' | 'bag' | 'arrow' | 'dot';

const paths: Record<IconName, string> = {
  link: 'M9 15l6-6M8.5 11.5 6 14a3.5 3.5 0 0 0 5 5l2.5-2.5M15.5 12.5 18 10a3.5 3.5 0 0 0-5-5l-2.5 2.5',
  anvil: 'M3 17h18M5 17v-4h9l3 4M8 13V9h8v4',
  bag: 'M6 8h12l-1 12H7L6 8Zm3 0V6a3 3 0 0 1 6 0v2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  dot: 'M12 12h.01',
};

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const path = paths[(name as IconName) in paths ? (name as IconName) : 'dot'];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}
