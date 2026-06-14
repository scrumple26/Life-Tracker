export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <rect width="512" height="512" rx="112" fill="#3c6e47" />
      <path
        d="M256 392c-8 0-16-3-22-9l-96-96c-34-34-34-89 0-123 30-30 78-33 111-9 33-24 81-21 111 9 34 34 34 89 0 123l-96 96c-6 6-14 9-22 9z"
        fill="#f4f4e9"
      />
      <circle cx="256" cy="226" r="20" fill="#3c6e47" />
    </svg>
  );
}

export function BrandName({ className = "" }: { className?: string }) {
  return (
    <span className={`font-[family-name:var(--font-fraunces)] font-semibold tracking-tight ${className}`}>
      lifelo<span className="text-amber">n</span>g
    </span>
  );
}
