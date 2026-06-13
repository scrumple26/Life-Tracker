export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <section className="lf-rise">
      <h2 className="text-3xl text-ink mb-1">{title}</h2>
      <p className="text-ink-soft mb-8">{blurb}</p>
      <div className="card p-10 text-center">
        <div className="text-4xl mb-3">🪵</div>
        <p className="text-ink font-semibold">Being rebuilt in the new design</p>
        <p className="text-sm text-muted mt-1">
          Your existing data is safe — this view is next on the redesign list.
        </p>
      </div>
    </section>
  );
}
