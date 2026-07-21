import type { InvestigationRecord } from "../lib/history";
import { formatRelativeTime } from "../lib/history";

interface SidebarProps {
  history: InvestigationRecord[];
  selectedId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function Sidebar({ history, selectedId, disabled, onSelect, onNew }: SidebarProps) {
  return (
    <nav className="sidebar">
      <button className="sidebar__new" onClick={onNew} disabled={disabled}>
        + New investigation
      </button>
      <div className="sidebar__list">
        {history.length === 0 && <p className="sidebar__empty">No investigations yet</p>}
        {history.map((record) => (
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
    </nav>
  );
}
