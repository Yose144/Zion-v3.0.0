type IconName =
  | 'link'
  | 'anvil'
  | 'bag'
  | 'arrow'
  | 'dot'
  | 'anchor'
  | 'vote'
  | 'book'
  | 'tower'
  | 'orbit'
  | 'key';

const paths: Record<IconName, string> = {
  link: 'M9 15l6-6M8.5 11.5 6 14a3.5 3.5 0 0 0 5 5l2.5-2.5M15.5 12.5 18 10a3.5 3.5 0 0 0-5-5l-2.5 2.5',
  anvil: 'M3 17h18M5 17v-4h9l3 4M8 13V9h8v4',
  bag: 'M6 8h12l-1 12H7L6 8Zm3 0V6a3 3 0 0 1 6 0v2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  dot: 'M12 12h.01',
  anchor: 'M12 8v13M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 13H3a9 9 0 0 0 18 0h-2',
  vote: 'M4 21h16M12 3l7 4-7 4-7-4 7-4ZM7 11v5M17 11v5',
  book: 'M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5ZM8 3v18',
  tower: 'M12 3l4 6-2 1v9l2 2H8l2-2v-9l-2-1 4-6Z',
  orbit: 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM4 12c0-2.5 3.6-4.5 8-4.5s8 2 8 4.5-3.6 4.5-8 4.5-8-2-8-4.5Z',
  key: 'M14 7a4 4 0 1 0-3.6 4L4 17v3h3l1-1v-2h2v-2h2l1.4-1.4A4 4 0 0 0 14 7Z',
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
