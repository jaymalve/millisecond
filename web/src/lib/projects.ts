export interface Project {
  id: string;
  name: string;
  workerName: string;
}

/**
 * "target/" is the one real, wired-up project — every investigation
 * actually talks to it regardless of what's selected here. Additional
 * projects added via the UI are cosmetic for now (see Sidebar/AddProjectModal):
 * the point is to have the shape in place, not to wire per-project agent
 * scoping yet.
 */
const DEFAULT_PROJECT: Project = { id: "target", name: "target", workerName: "millisecond-target" };

const STORAGE_KEY = "millisecond.projects";

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fall through to default
  }
  return [DEFAULT_PROJECT];
}

export function saveProjects(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // localStorage can fail (quota, private browsing) — not worth surfacing an error for.
  }
}
