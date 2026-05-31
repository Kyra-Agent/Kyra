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
        <h2>Internal modules power every template.</h2>
        <p>
          Users choose simple agent templates. Kyra keeps its identity through a focused
          roster of research, data, execution, and security modules.
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
