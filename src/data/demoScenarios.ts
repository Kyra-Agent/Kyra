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
    label: "Swap",
    command: "swap 10 USDC to ETH",
    templateId: "operator",
    route: "USDC -> WETH via Base liquidity route",
    risk: "normal",
    network: "Base",
    approvalRequired: true,
    lines: [
      "NIRA-01 parsed intent: token_swap",
      "NOVA-04 balance check: USDC available",
      "NYX-05 risk check: normal",
      "BASE ACTION approval request created",
      "status: waiting_for_wallet_approval",
    ],
  },
  {
    id: "verify",
    label: "Verify Holder",
    command: "verify holder access",
    templateId: "steward",
    route: "Wallet ownership + holder status proof",
    risk: "read-only",
    network: "Base",
    approvalRequired: false,
    lines: [
      "NIRA-01 parsed intent: holder_verify",
      "NOVA-04 reading token holder context",
      "NYX-05 signature scope check: read-only",
      "BASE ACTION proof request simulated",
      "status: holder verification ready",
    ],
  },
  {
    id: "scan",
    label: "Launch Scan",
    command: "scan new Base launches",
    templateId: "scout",
    route: "Launch monitor + token risk brief",
    risk: "review",
    network: "Base",
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
    network: "Base",
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
