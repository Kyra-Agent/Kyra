import { currentProductChain } from "../config/productChains";

export interface DemoScenario {
  id: string;
  label: string;
  command: string;
  templateId: string;
  route: string;
  risk: "normal" | "review" | "read-only";
  network: string;
  approvalRequired: boolean;
  lines: string[];
}

export const demoScenarios: DemoScenario[] = [
  {
    id: "swap",
    label: "Swap Review",
    command: "review 10 USDC to ETH swap",
    templateId: "operator",
    route: "USDC -> WETH review route on " + currentProductChain.name,
    risk: "review",
    network: currentProductChain.name,
    approvalRequired: true,
    lines: [
      "NIRA-01 parsed intent: token_swap_review",
      "NOVA-04 balance check: USDC available",
      "NYX-05 risk check: review required",
      "CHAIN ACTION review draft created",
      "status: wallet_execution_disabled",
    ],
  },
  {
    id: "verify",
    label: "Verify Holder",
    command: "verify holder access",
    templateId: "steward",
    route: "Wallet ownership + holder status proof",
    risk: "read-only",
    network: currentProductChain.name,
    approvalRequired: false,
    lines: [
      "NIRA-01 parsed intent: holder_verify",
      "NOVA-04 reading token holder context",
      "NYX-05 wallet scope check: read-only",
      "CHAIN ACTION proof request simulated",
      "status: holder verification ready",
    ],
  },
  {
    id: "scan",
    label: "Launch Scan",
    command: "scan new " + currentProductChain.name + " launches",
    templateId: "scout",
    route: "Launch monitor + token risk brief",
    risk: "review",
    network: currentProductChain.name,
    approvalRequired: false,
    lines: [
      "VEXA-02 scanning launch surfaces",
      "ASTRA-03 summarizing project context",
      "NOVA-04 loading token liquidity signals",
      "NYX-05 marking contracts for review",
      "status: recon brief generated",
    ],
  },
  {
    id: "strategy",
    label: "Strategy Brief",
    command: "draft market-aware campaign plan",
    templateId: "strategist",
    route: "Market brief + narrative map + campaign plan",
    risk: "review",
    network: currentProductChain.name,
    approvalRequired: false,
    lines: [
      "ASTRA-03 framing token and project context",
      "NOVA-04 loading community and market signals",
      "VEXA-02 mapping launch narrative angles",
      "ASTRA-03 drafting campaign decision brief",
      "status: strategist brief ready",
    ],
  },
];
