export type TemplateStatus = "mvp" | "advanced" | "coming-soon";

export interface AgentTemplate {
  id: string;
  name: string;
  role: string;
  status: TemplateStatus;
  summary: string;
  bestFor: string;
  actions: string[];
  modules: string[];
  terminalSeed: string;
}

export interface ActionDefinition {
  id: string;
  name: string;
  summary: string;
  tier: "demo" | "mvp" | "later";
}

export interface CoreModule {
  id: string;
  name: string;
  title: string;
  summary: string;
  status: "online" | "standby" | "guard";
}

export interface FAQItem {
  question: string;
  answer: string;
}
