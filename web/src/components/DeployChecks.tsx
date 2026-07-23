import { CircleCheck, TriangleAlert } from "lucide-react";
import { formatRelativeTime } from "../lib/history";
import type { DeployDetail } from "../lib/deploys";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "./ui/item";

interface DeployChecksProps {
  deploy: DeployDetail;
  onViewAlert: (alertId: string) => void;
}

/** Per-route breakdown for one CI-registered deploy — the detail view a Sidebar "Deploys" row opens into. */
export function DeployChecks({ deploy, onViewAlert }: DeployChecksProps) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline gap-2.5">
        <h2 className="font-mono text-lg font-semibold">{deploy.sha.slice(0, 7)}</h2>
        <span className="text-xs text-muted-foreground">{formatRelativeTime(deploy.deployedAt)}</span>
      </header>

      {deploy.checks.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleCheck />
            </EmptyMedia>
            <EmptyTitle>No checks yet</EmptyTitle>
            <EmptyDescription>Still warming up — route checks land here once the deploy has settled.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup>
          {deploy.checks.map((check) => (
            <Item key={check.id} variant="outline">
              <ItemMedia variant="icon">
                {check.regressionDetected ? (
                  <TriangleAlert className="text-(--danger)" />
                ) : (
                  <CircleCheck className="text-(--success)" />
                )}
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  <span className="font-mono">{check.route}</span>
                  <Badge
                    variant={check.regressionDetected ? "destructive" : "outline"}
                    className={check.regressionDetected ? "" : "border-(--success)/40 text-(--success)"}
                  >
                    {check.regressionDetected ? "regressed" : "clean"}
                  </Badge>
                </ItemTitle>
                <ItemDescription>
                  {formatRelativeTime(check.checkedAt)}
                  {check.baselineSha && ` · baseline ${check.baselineSha.slice(0, 7)}`}
                </ItemDescription>
              </ItemContent>
              {check.alertId && (
                <ItemActions>
                  <Button variant="ghost" size="sm" onClick={() => onViewAlert(check.alertId!)}>
                    View investigation →
                  </Button>
                </ItemActions>
              )}
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
