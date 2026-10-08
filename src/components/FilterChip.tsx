"use client";

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition ${
        active
          ? "bg-terracotta text-white"
          : "bg-paper-2 text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** List / Map style two-way switch. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex p-1 rounded-full bg-paper-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
            value === o.id ? "bg-card text-ink shadow-[var(--shadow-soft)]" : "text-ink-soft hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
