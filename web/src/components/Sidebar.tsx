import type { InvestigationRecord } from "../lib/history";
import { formatRelativeTime } from "../lib/history";
import type { Project } from "../lib/projects";
import type { AlertSummary } from "../lib/alerts";
import { getDeployStatus, type DeploySummary } from "../lib/deploys";
import { Skeleton } from "./Skeleton";

const DEPLOY_STATUS_ICON = { pending: "○", clean: "✓", regressed: "⚠" } as const;

interface SidebarProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onAddProjectClick: () => void;
  alerts: AlertSummary[];
  selectedAlertId: string | null;
  onSelectAlert: (id: string) => void;
  deploys: DeploySummary[];
  deploysLoading: boolean;
  selectedDeploySha: string | null;
  onSelectDeploy: (sha: string) => void;
  history: InvestigationRecord[];
  selectedId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function Sidebar({
  projects,
  activeProjectId,
  onSelectProject,
  onAddProjectClick,
  alerts,
  selectedAlertId,
  onSelectAlert,
  deploys,
  deploysLoading,
  selectedDeploySha,
  onSelectDeploy,
  history,
  selectedId,
  disabled,
  onSelect,
  onNew,
}: SidebarProps) {
  return (
    <nav className="sidebar">
      <button className="sidebar__new" onClick={onNew} disabled={disabled}>
        + New investigation
      </button>

      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <span>Projects</span>
          <button className="sidebar__add" onClick={onAddProjectClick} title="Add project">
            +
          </button>
        </div>
        {projects.map((project) => (
          <button
            key={project.id}
            className={`sidebar__project ${project.id === activeProjectId ? "sidebar__project--active" : ""}`}
            onClick={() => onSelectProject(project.id)}
          >
            {project.name}
          </button>
        ))}
      </div>

      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <span>Alerts</span>
        </div>
        <div className="sidebar__list">
          {alerts.length === 0 && <p className="sidebar__empty">No alerts</p>}
          {alerts.map((alert) => (
            <button
              key={alert.id}
              className={`sidebar__item ${alert.id === selectedAlertId ? "sidebar__item--active" : ""}`}
              onClick={() => onSelectAlert(alert.id)}
              disabled={disabled}
            >
              <span className="sidebar__item-question">⚠ {alert.route}</span>
              <span className="sidebar__item-time">{formatRelativeTime(alert.detectedAt)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar__section">
        <div className="sidebar__section-header">
          <span>Deploys</span>
        </div>
        <div className="sidebar__list">
          {deploysLoading && (
            <>
              <div className="sidebar__item">
                <Skeleton width="70%" />
              </div>
              <div className="sidebar__item">
                <Skeleton width="55%" />
              </div>
            </>
          )}
          {!deploysLoading && deploys.length === 0 && <p className="sidebar__empty">No deploys</p>}
          {!deploysLoading &&
            deploys.map((deploy) => {
              const status = getDeployStatus(deploy);
              return (
                <button
                  key={deploy.sha}
                  className={`sidebar__item ${deploy.sha === selectedDeploySha ? "sidebar__item--active" : ""}`}
                  onClick={() => onSelectDeploy(deploy.sha)}
                  disabled={disabled}
                >
                  <span className="sidebar__item-question">
                    <span className={`deploy-status deploy-status--${status}`}>{DEPLOY_STATUS_ICON[status]}</span>{" "}
                    {deploy.sha.slice(0, 7)}
                  </span>
                  <span className="sidebar__item-time">{formatRelativeTime(deploy.deployedAt)}</span>
                </button>
              );
            })}
        </div>
      </div>

      <div className="sidebar__section sidebar__section--grow">
        <div className="sidebar__section-header">
          <span>History</span>
        </div>
        <div className="sidebar__list">
          {history.length === 0 && <p className="sidebar__empty">No investigations yet</p>}
          {projects.map((project) => {
            const projectHistory = history.filter((r) => r.projectId === project.id);
            if (projectHistory.length === 0) return null;
            return (
              <div key={project.id} className="sidebar__group">
                {projects.length > 1 && <div className="sidebar__group-label">{project.name}</div>}
                {projectHistory.map((record) => (
                  <button
                    key={record.id}
                    className={`sidebar__item ${record.id === selectedId ? "sidebar__item--active" : ""}`}
                    onClick={() => onSelect(record.id)}
                    disabled={disabled}
                  >
                    <span className="sidebar__item-question">{record.question}</span>
                    <span className="sidebar__item-time">{formatRelativeTime(record.createdAt)}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
