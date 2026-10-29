'use client';

/** Chart time-range selector — caller slices its series by `hours`. */
export default function RangeTabs({
  value,
  onChange,
  ranges = [1, 6, 24],
}: {
  value: number;
  onChange: (hours: number) => void;
  ranges?: number[];
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
      {ranges.map((h) => (
        <button
          key={h}
          onClick={() => onChange(h)}
          className={`rounded-md px-2.5 py-1 text-[0.68rem] font-bold transition-colors ${
            value === h
              ? 'bg-rasta-gold/20 text-rasta-gold'
              : 'text-white/40 hover:text-white/80'
          }`}
        >
          {h}h
        </button>
      ))}
    </div>
  );
}
