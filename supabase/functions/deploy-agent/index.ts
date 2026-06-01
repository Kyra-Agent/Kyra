import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type TemplateStatus = "mvp" | "advanced" | "coming-soon";
type AgentStatus = "online" | "draft";
type ApprovalRisk = "normal" | "review" | "read-only";
type ApprovalStatus = "waiting_wallet" | "read_only_ready" | "review_required";

interface DeployAgentRequest {
  templateId?: unknown;
  agentName?: unknown;
  selectedActions?: unknown;
}

interface AgentTemplateRow {
  id: string;
  name: string;
  role: string;
  status: TemplateStatus;
  summary: string;
  actions: unknown;
  modules: unknown;
  terminal_seed: string | null;
}

interface WorkspaceRow {
  id: string;
  owner_user_id: string;
  name: string;
  mode: "demo" | "live";
  created_at: string;
}

interface AgentInstanceRow {
  id: string;
  workspace_id: string;
  template_id: string;
  display_name: string;
  handle: string;
  public_slug: string;
  status: AgentStatus;
}

interface WalletPolicyRow {
  id: string;
}

interface DemoScenario {
  id: string;
  title: string;
  command: string;
  route: string;
  risk: ApprovalRisk;
  approvalRequired: boolean;
}

class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(statusCode: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const scenarios: Record<string, DemoScenario> = {
  operator: {
    id: "swap",
    title: "Swap prepared",
    command: "swap 10 USDC to ETH",
    route: "USDC -> WETH via Base liquidity route",
    risk: "normal",
    approvalRequired: true,
  },
  scout: {
    id: "scan",
    title: "Scout demo action",
    command: "scan new Base launches",
    route: "Launch monitor + token risk brief",
    risk: "review",
    approvalRequired: false,
  },
  steward: {
    id: "verify",
    title: "Holder verification",
    command: "verify holder access",
    route: "Wallet ownership + holder status proof",
    risk: "read-only",
    approvalRequired: false,
  },
  strategist: {
    id: "strategy",
    title: "Strategy brief",
    command: "draft market-aware campaign plan",
    route: "Market brief + narrative map + campaign plan",
    risk: "review",
    approvalRequired: false,
  },
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getEnv(key: string) {
  const value = Deno.env.get(key);

  if (!value) {
    throw new HttpError(500, "missing_env", `Missing required Edge Function secret: ${key}.`);
  }

  return value;
}

function getDemoLimit() {
  const value = Number(Deno.env.get("KYRA_DEMO_AGENT_LIMIT") ?? "3");
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 3;
}

function getHealthPayload() {
  const requirements = {
    supabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
    anonKey: Boolean(Deno.env.get("SUPABASE_ANON_KEY")),
    serviceRoleKey: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
  };
  const ready = requirements.supabaseUrl && requirements.anonKey && requirements.serviceRoleKey;

  return {
    ok: ready,
    status: ready ? "ready" : "missing_secret",
    function: "deploy-agent",
    mode: "demo",
    demoAgentLimit: getDemoLimit(),
  };
}

function assertString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "invalid_request", `${label} is required.`);
  }

  return value.trim();
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readJsonArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeAgentName(agentName: unknown, template: AgentTemplateRow) {
  if (typeof agentName !== "string") {
    return `Kyra ${template.name}`;
  }

  const value = agentName.replace(/\s+/g, " ").trim().slice(0, 64);
  return value || `Kyra ${template.name}`;
}

function createPublicSlug(templateId: string, userId: string) {
  const userPart = userId.replace(/-/g, "").slice(0, 8);
  const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${templateId}-${userPart}-${randomPart}`;
}

function createTelegramHandle(templateId: string, publicSlug: string) {
  return `@kyra_${templateId}_${publicSlug.slice(-5)}`;
}

function getScenario(templateId: string, template: AgentTemplateRow): DemoScenario {
  return (
    scenarios[templateId] ?? {
      id: "custom",
      title: `${template.name} demo action`,
      command: template.terminal_seed || "prepare demo action",
      route: "Kyra demo action route",
      risk: "review",
      approvalRequired: true,
    }
  );
}

function getApprovalStatus(scenario: DemoScenario): ApprovalStatus {
  if (scenario.approvalRequired) {
    return "waiting_wallet";
  }

  return scenario.risk === "read-only" ? "read_only_ready" : "review_required";
}

function sanitizeErrorMessage(message: string) {
  return message
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "sb_secret_[hidden]")
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "sb_publishable_[hidden]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "jwt_[hidden]")
    .slice(0, 240);
}

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error) {
    const payload = error as Record<string, unknown>;
    const parts = [payload.message, payload.details, payload.hint, payload.code]
      .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
      .map((part) => part.trim());

    if (parts.length) {
      return parts.join(" ");
    }
  }

  return "Deploy agent function failed.";
}

async function getUserClient(supabaseUrl: string, anonKey: string, authorization: string) {
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const { data, error } = await userClient.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, "unauthorized", "A valid Supabase session is required.");
  }

  return data.user;
}

async function ensureWorkspace(serviceClient: ReturnType<typeof createClient>, userId: string) {
  const { data: existing, error: readError } = await serviceClient
    .from("workspaces")
    .select("id,owner_user_id,name,mode,created_at")
    .eq("owner_user_id", userId)
    .eq("mode", "demo")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<WorkspaceRow>();

  if (readError) {
    throw readError;
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } = await serviceClient
    .from("workspaces")
    .insert({
      owner_user_id: userId,
      name: "Kyra demo workspace",
      mode: "demo",
    })
    .select("id,owner_user_id,name,mode,created_at")
    .single<WorkspaceRow>();

  if (createError || !created) {
    throw createError ?? new Error("Workspace creation failed.");
  }

  return created;
}

async function getTemplate(serviceClient: ReturnType<typeof createClient>, templateId: string) {
  const { data, error } = await serviceClient
    .from("agent_templates")
    .select("id,name,role,status,summary,actions,modules,terminal_seed")
    .eq("id", templateId)
    .maybeSingle<AgentTemplateRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(404, "template_not_found", "Agent template was not found.");
  }

  return data;
}

async function getAgentCount(serviceClient: ReturnType<typeof createClient>, workspaceId: string) {
  const { count, error } = await serviceClient
    .from("agent_instances")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("mode", "demo");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function insertAgent(
  serviceClient: ReturnType<typeof createClient>,
  workspaceId: string,
  template: AgentTemplateRow,
  userId: string,
  agentName: string,
) {
  const publicSlug = createPublicSlug(template.id, userId);
  const handle = createTelegramHandle(template.id, publicSlug);
  const status: AgentStatus = template.status === "coming-soon" ? "draft" : "online";
  const { data, error } = await serviceClient
    .from("agent_instances")
    .insert({
      workspace_id: workspaceId,
      template_id: template.id,
      display_name: agentName,
      handle,
      public_slug: publicSlug,
      status,
      mode: "demo",
      network: "base",
      telegram_status: "mocked",
      base_mcp_status: "mocked",
    })
    .select("id,workspace_id,template_id,display_name,handle,public_slug,status")
    .single<AgentInstanceRow>();

  if (error || !data) {
    if (error?.message?.toLowerCase().includes("demo agent limit")) {
      throw new HttpError(409, "quota_exceeded", "Demo agent limit reached.");
    }

    throw error ?? new Error("Agent creation failed.");
  }

  return data;
}

async function insertWalletPolicy(
  serviceClient: ReturnType<typeof createClient>,
  workspaceId: string,
  agentId: string,
  selectedActions: string[],
) {
  const { data, error } = await serviceClient
    .from("wallet_policies")
    .insert({
      workspace_id: workspaceId,
      agent_id: agentId,
      wallet_label: "Demo Base Account",
      wallet_address: null,
      daily_limit_usdc: 100,
      approval_required: true,
      allowed_actions: selectedActions,
      status: "simulated",
    })
    .select("id")
    .single<WalletPolicyRow>();

  if (error || !data) {
    throw error ?? new Error("Wallet policy creation failed.");
  }

  return data;
}

async function insertRelatedRecords(
  serviceClient: ReturnType<typeof createClient>,
  workspace: WorkspaceRow,
  agent: AgentInstanceRow,
  template: AgentTemplateRow,
  policy: WalletPolicyRow,
) {
  const scenario = getScenario(template.id, template);

  const { error: updateError } = await serviceClient
    .from("agent_instances")
    .update({ approval_policy_id: policy.id })
    .eq("id", agent.id);

  if (updateError) {
    throw updateError;
  }

  const { error: approvalError } = await serviceClient.from("approval_requests").insert({
    workspace_id: workspace.id,
    agent_id: agent.id,
    scenario_id: scenario.id,
    title: scenario.title,
    command: template.terminal_seed || scenario.command,
    route: scenario.route,
    risk: scenario.risk,
    status: getApprovalStatus(scenario),
    fee_payer: "connected_wallet",
    requires_wallet: scenario.approvalRequired,
    prepared_tx: {
      demo: true,
      template_id: template.id,
      onchain_execution: "disabled",
      source: "deploy-agent-edge-function",
    },
  });

  if (approvalError) {
    throw approvalError;
  }

  const { error: telegramError } = await serviceClient.from("telegram_sessions").insert({
    agent_id: agent.id,
    bot_handle: agent.handle,
    webhook_status: "mocked",
    token_secret_ref: null,
  });

  if (telegramError) {
    throw telegramError;
  }

  const { error: logsError } = await serviceClient.from("activity_logs").insert([
    {
      workspace_id: workspace.id,
      agent_id: agent.id,
      source: "agent_instances",
      level: "info",
      message: `created ${template.name} demo agent from deploy-agent function`,
    },
    {
      workspace_id: workspace.id,
      agent_id: agent.id,
      source: "telegram_sessions",
      level: "notice",
      message: "Telegram interface stored as simulated session",
    },
    {
      workspace_id: workspace.id,
      agent_id: agent.id,
      source: "approval_requests",
      level: "notice",
      message: "demo approval request persisted with wallet approval required",
    },
  ]);

  if (logsError) {
    throw logsError;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (request.method === "GET") {
      const payload = getHealthPayload();

      return jsonResponse(payload, payload.ok ? 200 : 503);
    }

    if (request.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Use POST for deploy-agent.");
    }

    const authorization = request.headers.get("Authorization") ?? "";

    if (!authorization.toLowerCase().startsWith("bearer ")) {
      throw new HttpError(401, "unauthorized", "A valid Supabase session is required.");
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const limit = getDemoLimit();
    const body = (await request.json()) as DeployAgentRequest;
    const templateId = assertString(body.templateId, "templateId");

    const user = await getUserClient(supabaseUrl, anonKey, authorization);
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const workspace = await ensureWorkspace(serviceClient, user.id);
    const used = await getAgentCount(serviceClient, workspace.id);

    if (used >= limit) {
      throw new HttpError(409, "quota_exceeded", `Demo agent limit reached (${used}/${limit}).`, {
        quota: {
          used,
          limit,
          remaining: 0,
        },
      });
    }

    const template = await getTemplate(serviceClient, templateId);
    const allowedActions = readJsonArray(template.actions);
    const requestedActions = normalizeStringArray(body.selectedActions);
    const filteredActions = requestedActions.length
      ? requestedActions.filter((action) => allowedActions.includes(action))
      : allowedActions;
    const selectedActions = filteredActions.length ? filteredActions : allowedActions;
    const agentName = normalizeAgentName(body.agentName, template);
    const agent = await insertAgent(serviceClient, workspace.id, template, user.id, agentName);
    const policy = await insertWalletPolicy(serviceClient, workspace.id, agent.id, selectedActions);

    await insertRelatedRecords(serviceClient, workspace, agent, template, policy);

    return jsonResponse(
      {
        ok: true,
        status: "saved",
        message: "Demo deployment persisted by deploy-agent function.",
        workspaceId: workspace.id,
        agentId: agent.id,
        publicSlug: agent.public_slug,
        publicPath: `/agents/${agent.public_slug}`,
        quota: {
          used: used + 1,
          limit,
          remaining: Math.max(0, limit - used - 1),
        },
        receipt: {
          template: template.name,
          agent: agent.display_name,
          telegram: agent.handle,
          wallet: "approval_required",
          mode: "demo",
          execution: "disabled",
        },
      },
      201,
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        {
          ok: false,
          status: error.code,
          message: error.message,
          ...error.details,
        },
        error.statusCode,
      );
    }

    return jsonResponse(
      {
        ok: false,
        status: "server_error",
        message: sanitizeErrorMessage(getUnknownErrorMessage(error)),
      },
      500,
    );
  }
});
