import { Cpu, Radar, ShieldCheck } from "lucide-react";
import { coreModules } from "../data/modules";

const statusIcon = {
  online: Cpu,
  standby: Radar,
  guard: ShieldCheck,
};

export function CoreModules() {
  return (
    <section className="section modules-section">
      <div className="section-heading">
        <p className="eyebrow">Kyra Core</p>
        <h2>The coded roster runs behind the templates.</h2>
        <p>
          Users choose clear templates. Kyra still gets a strong identity through its
          internal module system.
        </p>
      </div>

      <div className="module-board">
        {coreModules.map((module) => {
          const Icon = statusIcon[module.status];

          return (
            <article className="module-row" key={module.id}>
              <span className="module-code">{module.name}</span>
              <span className="module-title">{module.title}</span>
              <p>{module.summary}</p>
              <span className={`module-status module-${module.status}`}>
                <Icon size={14} />
                {module.status}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
