interface SkeletonProps {
  width?: string;
  height?: string;
}

/** Reusable shimmer bar — the one primitive every skeleton in this app composes. */
export function Skeleton({ width = "100%", height = "0.9em" }: SkeletonProps) {
  return <div className="skeleton" style={{ width, height }} />;
}
