import { CityBackground } from "../components/CityBackground";

export function Landing() {
  return (
    <div className="landing">
      <CityBackground />
      <div className="landing__content">
        <header className="landing__header">
          <div>
            <p className="landing__kicker">millisecond.dev</p>
            <p className="landing__meta">An investigation agent for Cloudflare Workers.</p>
          </div>
          <a className="landing__cta" href="/app">
            Try millisecond
          </a>
        </header>

        <h1 className="landing__title">Why we built an agent to find out why, instead of another dashboard.</h1>

        <div className="landing__body">
          <p>A page gets slower. An API starts costing more. Most of the time, nobody notices until someone complains.</p>

          <p>
            When someone does notice, finding the cause is still a manual job. An engineer opens a metrics dashboard,
            then a deploy history, then a pile of commits, trying to line up a chart that moved with a change that
            shipped around the same time. It's slow, it's easy to get wrong, and it only happens when someone has the
            time to do it.
          </p>

          <p>
            On Cloudflare Workers, every extra millisecond a request takes is time you're billed for, on every single
            request that hits that route. A regression that sits unnoticed for a few weeks isn't a bug anymore. It's
            a bill nobody's traced back to a cause.
          </p>

          <p>
            <strong>Millisecond is an agent that does this investigation for you.</strong> Point it at a Cloudflare
            Workers service and it watches the real metrics on its own. When something regresses, it finds the
            moment it started, finds the deploy that lines up with it, reads that deploy's code diff, and checks the
            actual request traces to see which part of the code got slower.
          </p>

          <p>
            It doesn't guess. Every answer it gives is built from real numbers it pulled itself — a latency chart
            that moved, a commit that touched the right file, a trace that grew by the same amount as the
            regression. If the evidence doesn't add up to a clear answer, it says so, instead of making one up.
          </p>

          <p>
            You shouldn't need to be the one person on the team who remembers what "normal" looks like. Ask it what
            happened. It'll tell you — the cause, the evidence, the cost, and a fix.
          </p>
        </div>
      </div>
    </div>
  );
}
