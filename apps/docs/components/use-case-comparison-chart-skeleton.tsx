export function UseCaseComparisonChartSkeleton() {
  return (
    <div
      className="flex h-[28rem] w-full flex-col gap-3 overflow-visible sm:h-[32rem]"
      aria-busy="true"
      aria-label="Loading chart"
    >
      <div className="flex justify-end gap-4">
        <span className="h-2.5 w-28 animate-pulse bg-[color:var(--surface-raised)]" />
        <span className="h-2.5 w-32 animate-pulse bg-[color:var(--surface-raised)]" />
      </div>
      <div className="relative min-h-0 flex-1 border-b border-[color:var(--border-visible)]">
        <div className="absolute inset-y-0 left-0 flex w-20 flex-col justify-around py-2">
          {Array.from({ length: 4 }, (_, i) => (
            <span
              key={i}
              className="h-2.5 w-14 animate-pulse bg-[color:var(--surface-raised)]"
            />
          ))}
        </div>
        <div className="absolute inset-0 left-24 right-24 flex flex-col justify-around py-1">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col justify-center gap-1.5">
              <span
                className="h-3.5 animate-pulse bg-[color:var(--surface-raised)]"
                style={{ width: `${78 - i * 8}%` }}
              />
              <span
                className="h-3.5 animate-pulse bg-[color:var(--surface-raised)]"
                style={{ width: `${14 + (i % 2) * 4}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
