import { formatRelativeTime } from "../lib/history";
import type { DeployDetail } from "../lib/deploys";

interface DeployChecksProps {
  deploy: DeployDetail;
  onViewAlert: (alertId: string) => void;
}

/** Per-route breakdown for one CI-registered deploy — the detail view a Sidebar "Deploys" row opens into. */
export function DeployChecks({ deploy, onViewAlert }: DeployChecksProps) {
  return (
    <div className="deploy-checks">
      <header className="deploy-checks__header">
        <h2>{deploy.sha.slice(0, 7)}</h2>
        <span className="deploy-checks__time">{formatRelativeTime(deploy.deployedAt)}</span>
      </header>

      {deploy.checks.length === 0 && (
        <p className="deploy-checks__empty">No checks completed yet — still warming up.</p>
      )}

      <div className="deploy-checks__list">
        {deploy.checks.map((check) => (
          <div key={check.id} className={`deploy-check deploy-check--${check.regressionDetected ? "regressed" : "clean"}`}>
            <div className="deploy-check__row">
              <span className="deploy-check__status">{check.regressionDetected ? "⚠" : "✓"}</span>
              <span className="deploy-check__route">{check.route}</span>
              <span className="deploy-check__time">{formatRelativeTime(check.checkedAt)}</span>
            </div>
            {check.baselineSha && (
              <p className="deploy-check__baseline">baseline {check.baselineSha.slice(0, 7)}</p>
            )}
            {check.alertId && (
              <button className="deploy-check__alert-link" onClick={() => onViewAlert(check.alertId!)}>
                View investigation →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
