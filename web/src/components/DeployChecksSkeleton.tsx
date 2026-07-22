import { Skeleton } from "./Skeleton";

/** Shown while fetching a selected deploy's per-route detail — approximates DeployChecks' header + row shape rather than a generic spinner. */
export function DeployChecksSkeleton() {
  return (
    <div className="deploy-checks">
      <header className="deploy-checks__header">
        <Skeleton width="110px" height="1.1em" />
        <Skeleton width="64px" height="0.8em" />
      </header>
      <div className="deploy-checks__list">
        <div className="deploy-check">
          <Skeleton width="85%" />
        </div>
        <div className="deploy-check">
          <Skeleton width="70%" />
        </div>
      </div>
    </div>
  );
}
