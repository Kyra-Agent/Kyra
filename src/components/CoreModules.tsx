import { useState } from "react";
import { Cpu, Radar, ShieldCheck } from "lucide-react";
import { coreModules } from "../data/modules";
import { ModuleSignal } from "./ModuleSignal";
import { RevealHeading } from "./RevealHeading";

const statusIcon = {
  online: Cpu,
  standby: Radar,
  guard: ShieldCheck,
};

export function CoreModules() {
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  return (
    <section className="section modules-section">
      <div className="section-heading">
        <p className="eyebrow">Kyra Core</p>
        <RevealHeading text="Internal modules power every template." />
        <p>
          Users choose simple agent templates. Kyra keeps its identity through a focused
          roster of recon, research, data, and security modules.
        </p>
      </div>

      <div className="module-layout">
        <ModuleSignal activeId={activeModuleId} onActivate={setActiveModuleId} />

        <div className="module-board">
          {coreModules.map((module) => {
            const Icon = statusIcon[module.status];

            return (
              <article
                className={`module-row${activeModuleId === module.id ? " is-linked" : ""}`}
                key={module.id}
                onPointerEnter={() => setActiveModuleId(module.id)}
                onPointerLeave={() => setActiveModuleId(null)}
              >
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
      </div>
    </section>
  );
}
