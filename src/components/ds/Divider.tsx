/** A thin rule with a word in the middle, e.g. "or". */
export function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-caption text-muted" role="separator">
      <span className="h-px flex-1 bg-track" />
      <span>{children}</span>
      <span className="h-px flex-1 bg-track" />
    </div>
  );
}
