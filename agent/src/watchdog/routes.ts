/**
 * Routes the watchdog checks on a schedule. Hardcoded to target/'s known
 * routes for now — the Projects UI in web/ doesn't do real per-project
 * agent scoping yet (see web/src/lib/projects.ts), so there's nothing to
 * iterate over beyond this single project.
 */
export const MONITORED_ROUTES = ["/api/orders", "/api/products"];
