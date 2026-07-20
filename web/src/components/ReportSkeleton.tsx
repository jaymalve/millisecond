import { Skeleton } from "./Skeleton";

/** Shaped like the report that's about to stream in: headline, evidence lines, cost line, fix block. */
export function ReportSkeleton() {
  return (
    <div className="report-skeleton">
      <Skeleton width="70%" height="1.1em" />
      <div className="report-skeleton__group">
        <Skeleton width="95%" />
        <Skeleton width="88%" />
        <Skeleton width="60%" />
      </div>
      <Skeleton width="40%" />
      <Skeleton width="100%" height="4.5em" />
    </div>
  );
}
