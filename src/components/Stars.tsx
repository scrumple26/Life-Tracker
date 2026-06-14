"use client";

export function Stars({
  value,
  onChange,
  size = 16,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
}) {
  const editable = !!onChange;
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!editable}
          onClick={() => onChange?.(n === value ? 0 : n)}
          className={`leading-none ${editable ? "cursor-pointer hover:scale-110 transition" : "cursor-default"}`}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <span
            style={{ fontSize: size }}
            className={n <= value ? "text-amber" : "text-line-strong"}
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}
