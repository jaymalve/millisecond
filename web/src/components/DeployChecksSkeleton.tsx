import { Skeleton } from "./ui/skeleton";
import { Item, ItemContent, ItemGroup, ItemMedia } from "./ui/item";

/** Shown while fetching a selected deploy's per-route detail — approximates DeployChecks' header + row shape rather than a generic spinner. */
export function DeployChecksSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline gap-2.5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3.5 w-16" />
      </header>
      <ItemGroup>
        <Item variant="outline">
          <ItemMedia variant="icon">
            <Skeleton className="size-4 rounded-full" />
          </ItemMedia>
          <ItemContent>
            <Skeleton className="h-4 w-3/4" />
          </ItemContent>
        </Item>
        <Item variant="outline">
          <ItemMedia variant="icon">
            <Skeleton className="size-4 rounded-full" />
          </ItemMedia>
          <ItemContent>
            <Skeleton className="h-4 w-3/5" />
          </ItemContent>
        </Item>
      </ItemGroup>
    </div>
  );
}
