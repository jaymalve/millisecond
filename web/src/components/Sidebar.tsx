import { Circle, CircleCheck, Clock, Folder, Plus, TriangleAlert } from "lucide-react";
import type { ConversationSummary } from "../lib/conversations";
import { formatRelativeTime } from "../lib/time";
import type { Project } from "../lib/projects";
import type { AlertSummary } from "../lib/alerts";
import { getDeployStatus, type DeploySummary } from "../lib/deploys";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "./ui/sidebar";

const DEPLOY_STATUS_ICON = { pending: Circle, clean: CircleCheck, regressed: TriangleAlert } as const;
const DEPLOY_STATUS_CLASS = {
  pending: "text-sidebar-foreground/40",
  clean: "text-(--success)",
  regressed: "text-(--danger)",
} as const;

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
  conversations: ConversationSummary[];
  selectedId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function EmptyRow({ children }: { children: string }) {
  return (
    <p className="px-2 py-1.5 text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">{children}</p>
  );
}

/** Two-line menu row (title + relative time) — the shape every Alerts/Deploys/History row shares. Hidden in icon-collapsed mode (the leading icon carries the row instead — two lines of text has no clean collapsed form). */
function RowLabel({ title, time, mono = false }: { title: string; time: string; mono?: boolean }) {
  return (
    <span className="flex flex-col items-start gap-0.5 overflow-hidden group-data-[collapsible=icon]:hidden">
      <span className={`w-full truncate ${mono ? "font-mono" : ""}`}>{title}</span>
      <span className="text-xs text-sidebar-foreground/50">{time}</span>
    </span>
  );
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
  conversations,
  selectedId,
  disabled,
  onSelect,
  onNew,
}: SidebarProps) {
  return (
    <SidebarPrimitive collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onNew} disabled={disabled} tooltip="New investigation">
              <Plus />
              <span>New investigation</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupAction onClick={onAddProjectClick} title="Add project">
            <Plus />
            <span className="sr-only">Add project</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects.map((project) => (
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton
                    isActive={project.id === activeProjectId}
                    onClick={() => onSelectProject(project.id)}
                    tooltip={project.name}
                  >
                    <Folder />
                    <span>{project.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Alerts</SidebarGroupLabel>
          <SidebarGroupContent>
            {alerts.length === 0 ? (
              <EmptyRow>No alerts</EmptyRow>
            ) : (
              <SidebarMenu>
                {alerts.map((alert) => (
                  <SidebarMenuItem key={alert.id}>
                    <SidebarMenuButton
                      size="lg"
                      isActive={alert.id === selectedAlertId}
                      onClick={() => onSelectAlert(alert.id)}
                      disabled={disabled}
                      tooltip={alert.route}
                    >
                      <TriangleAlert className="text-(--danger)" />
                      <RowLabel title={alert.route} time={formatRelativeTime(alert.detectedAt)} />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Deploys</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {deploysLoading && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                </>
              )}
              {!deploysLoading && deploys.length === 0 && (
                <SidebarMenuItem>
                  <EmptyRow>No deploys</EmptyRow>
                </SidebarMenuItem>
              )}
              {!deploysLoading &&
                deploys.map((deploy) => {
                  const status = getDeployStatus(deploy);
                  const StatusIcon = DEPLOY_STATUS_ICON[status];
                  return (
                    <SidebarMenuItem key={deploy.sha}>
                      <SidebarMenuButton
                        size="lg"
                        isActive={deploy.sha === selectedDeploySha}
                        onClick={() => onSelectDeploy(deploy.sha)}
                        disabled={disabled}
                        tooltip={deploy.sha.slice(0, 7)}
                      >
                        <StatusIcon className={DEPLOY_STATUS_CLASS[status]} />
                        <RowLabel title={deploy.sha.slice(0, 7)} time={formatRelativeTime(deploy.deployedAt)} mono />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>History</SidebarGroupLabel>
          <SidebarGroupContent>
            {conversations.length === 0 && <EmptyRow>No conversations yet</EmptyRow>}
            {projects.map((project) => {
              const projectConversations = conversations.filter((c) => c.projectId === project.id);
              if (projectConversations.length === 0) return null;
              return (
                <div key={project.id} className="mb-2">
                  {projects.length > 1 && (
                    <div className="px-2 py-1 text-[0.65rem] tracking-wide text-sidebar-foreground/40 uppercase group-data-[collapsible=icon]:hidden">
                      {project.name}
                    </div>
                  )}
                  <SidebarMenu>
                    {projectConversations.map((conversation) => (
                      <SidebarMenuItem key={conversation.id}>
                        <SidebarMenuButton
                          size="lg"
                          isActive={conversation.id === selectedId}
                          onClick={() => onSelect(conversation.id)}
                          disabled={disabled}
                          tooltip={conversation.title}
                        >
                          <Clock />
                          <RowLabel title={conversation.title} time={formatRelativeTime(conversation.updatedAt)} />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </div>
              );
            })}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </SidebarPrimitive>
  );
}
