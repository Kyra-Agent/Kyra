import { useEffect } from "react";
import { ArrowLeft, LayoutDashboard } from "lucide-react";

interface NotFoundProps {
  onHome: () => void;
  onDashboard: () => void;
}

// Unknown paths get a real "not found" view (Netlify also answers 404) and
// ask search engines not to index them.
export function NotFound({ onHome, onDashboard }: NotFoundProps) {
  useEffect(() => {
    const previousTitle = document.title;
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    document.title = "Page not found | Kyra Agent";

    return () => {
      robots.remove();
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="not-found-page">
      <section className="not-found-panel" aria-labelledby="not-found-title">
        <span className="not-found-code" aria-hidden="true">404</span>
        <h1 id="not-found-title">This page doesn&apos;t exist.</h1>
        <p>
          The link may be mistyped or out of date. Your agents and records are safe in your
          private dashboard.
        </p>
        <div className="not-found-actions">
          <button className="button button-primary" type="button" onClick={onHome}>
            <ArrowLeft size={16} />
            Back to Kyra
          </button>
          <button className="button button-ghost" type="button" onClick={onDashboard}>
            <LayoutDashboard size={16} />
            Open dashboard
          </button>
        </div>
      </section>
    </main>
  );
}
