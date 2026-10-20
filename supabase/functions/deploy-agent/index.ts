import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type AgentSettings,
  toAgentSettingsRow,
  validateAgentSettings,
} from "../_shared/agent-settings.ts";

type KyraSupabaseClient = ReturnType<typeof createClient<any>>;
type TemplateStatus = "mvp" | "advanced" | "coming-soon";
type AgentStatus = "online" | "draft";

type ChainKey = "robinhood_mainnet" | "robinhood_testnet";

interface ChainTarget {
  key: ChainKey;
  id: 4663 | 46630;
  name: "Robinhood Chain" | "Robinhood Chain Testnet";
  walletLabel: "Robinhood Chain wallet" | "Robinhood Chain Testnet wallet";
}

interface DeployAgentRequest {
  templateId?: unknown;
  agentName?: unknown;
  selectedActions?: unknown;
  chainKey?: unknown;
  chainId?: unknown;
  settings?: unknown;
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
  network: ChainKey;
}

interface WalletPolicyRow {
  id: string;
}

class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const chainTargets: Record<ChainKey, ChainTarget> = {
  robinhood_mainnet: {
    key: "robinhood_mainnet",
    id: 4663,
    name: "Robinhood Chain",
    walletLabel: "Robinhood Chain wallet",
  },
  robinhood_testnet: {
    key: "robinhood_testnet",
    id: 46630,
    name: "Robinhood Chain Testnet",
    walletLabel: "Robinhood Chain Testnet wallet",
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
    throw new HttpError(
      500,
      "missing_env",
      `Missing required Edge Function secret: ${key}.`,
    );
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
  const ready = requirements.supabaseUrl && requirements.anonKey &&
    requirements.serviceRoleKey;

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

function assertTemplateId(value: unknown) {
  const templateId = assertString(value, "templateId").toLowerCase();

  if (!/^[a-z0-9_-]{2,48}$/.test(templateId)) {
    throw new HttpError(400, "invalid_request", "templateId is invalid.");
  }

  return templateId;
}

function assertChainTarget(
  chainKeyValue: unknown,
  chainIdValue: unknown,
): ChainTarget {
  if (chainKeyValue === undefined && chainIdValue === undefined) {
    return chainTargets.robinhood_mainnet;
  }

  if (
    typeof chainKeyValue !== "string" ||
    !(chainKeyValue in chainTargets)
  ) {
    throw new HttpError(400, "invalid_chain", "chainKey is invalid.");
  }

  const chain = chainTargets[chainKeyValue as ChainKey];
  const chainId = typeof chainIdValue === "number"
    ? chainIdValue
    : typeof chainIdValue === "string" && /^\d+$/.test(chainIdValue)
    ? Number(chainIdValue)
    : Number.NaN;

  if (!Number.isSafeInteger(chainId) || chainId !== chain.id) {
    throw new HttpError(
      400,
      "invalid_chain",
      "chainKey and chainId must identify the same supported chain.",
    );
  }

  if (
    chain.key === "robinhood_mainnet" &&
    Deno.env.get("KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED") !== "true"
  ) {
    throw new HttpError(
      403,
      "chain_release_locked",
      "Robinhood Chain mainnet deployment is not released.",
    );
  }

  return chain;
}

async function readDeployRequestBody(
  request: Request,
): Promise<DeployAgentRequest> {
  try {
    const payload = await request.json();

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Expected object payload.");
    }

    return payload as DeployAgentRequest;
  } catch {
    throw new HttpError(
      400,
      "invalid_request",
      "Request body must be valid JSON.",
    );
  }
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

function sanitizeActivityLogMessage(message: string) {
  return message
    .replace(/\b\d{8,10}:[A-Za-z0-9_-]{35,}\b/g, "[telegram_token_hidden]")
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, "[api_key_hidden]")
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "sb_secret_[hidden]")
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "sb_publishable_[hidden]")
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "jwt_[hidden]",
    )
    .replace(/\b0x[a-fA-F0-9]{64}\b/g, "[private_key_or_hash_hidden]")
    .replace(/\b(?:seed phrase|private key|mnemonic)\b/gi, "[secret_hidden]")
    .slice(0, 180);
}

async function getUserClient(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
) {
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
    throw new HttpError(
      401,
      "unauthorized",
      "A valid Supabase session is required.",
    );
  }

  return data.user;
}

async function readExistingWorkspace(
  serviceClient: KyraSupabaseClient,
  userId: string,
) {
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

  return existing ?? null;
}

async function ensureWorkspace(
  serviceClient: KyraSupabaseClient,
  userId: string,
) {
  const existing = await readExistingWorkspace(serviceClient, userId);

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } = await serviceClient
    .from("workspaces")
    .insert({
      owner_user_id: userId,
      name: "Kyra workspace",
      mode: "demo",
    })
    .select("id,owner_user_id,name,mode,created_at")
    .single<WorkspaceRow>();

  if (createError || !created) {
    if (createError?.code === "23505") {
      const nextExisting = await readExistingWorkspace(serviceClient, userId);

      if (nextExisting) {
        return nextExisting;
      }
    }

    throw createError ?? new Error("Workspace creation failed.");
  }

  return created;
}

async function getTemplate(
  serviceClient: KyraSupabaseClient,
  templateId: string,
) {
  const { data, error } = await serviceClient
    .from("agent_templates")
    .select("id,name,role,status,summary,actions,modules,terminal_seed")
    .eq("id", templateId)
    .maybeSingle<AgentTemplateRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(
      404,
      "template_not_found",
      "Agent template was not found.",
    );
  }

  return data;
}

async function getAgentCount(
  serviceClient: KyraSupabaseClient,
  workspaceId: string,
) {
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
  serviceClient: KyraSupabaseClient,
  workspaceId: string,
  template: AgentTemplateRow,
  userId: string,
  agentName: string,
  chain: ChainTarget,
) {
  const publicSlug = createPublicSlug(template.id, userId);
  const handle = createTelegramHandle(template.id, publicSlug);
  const status: AgentStatus = template.status === "coming-soon"
    ? "draft"
    : "online";
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
      network: chain.key,
      chain_action_status: "ready",
      telegram_status: "mocked",
    })
    .select(
      "id,workspace_id,template_id,display_name,handle,public_slug,status,network",
    )
    .single<AgentInstanceRow>();

  if (error || !data) {
    if (error?.message?.toLowerCase().includes("demo agent limit")) {
      throw new HttpError(409, "quota_exceeded", "Agent limit reached.");
    }

    throw error ?? new Error("Agent creation failed.");
  }

  return data;
}

async function insertWalletPolicy(
  serviceClient: KyraSupabaseClient,
  workspaceId: string,
  agentId: string,
  selectedActions: string[],
  chain: ChainTarget,
) {
  const { data, error } = await serviceClient
    .from("wallet_policies")
    .insert({
      workspace_id: workspaceId,
      agent_id: agentId,
      wallet_label: chain.walletLabel,
      wallet_address: null,
      chain_key: chain.key,
      chain_id: chain.id,
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
  serviceClient: KyraSupabaseClient,
  workspace: WorkspaceRow,
  agent: AgentInstanceRow,
  template: AgentTemplateRow,
  policy: WalletPolicyRow,
) {
  const { error: updateError } = await serviceClient
    .from("agent_instances")
    .update({ approval_policy_id: policy.id })
    .eq("id", agent.id);

  if (updateError) {
    throw updateError;
  }

  const { error: telegramError } = await serviceClient.from("telegram_sessions")
    .insert({
      agent_id: agent.id,
      bot_handle: agent.handle,
      webhook_status: "mocked",
      token_secret_ref: null,
    });

  if (telegramError) {
    throw telegramError;
  }

  const { error: logsError } = await serviceClient.from("activity_logs").insert(
    [
      {
        workspace_id: workspace.id,
        agent_id: agent.id,
        source: "agent_instances",
        level: "info",
        message:
          `created ${template.name} agent from protected deploy flow`,
      },
      {
        workspace_id: workspace.id,
        agent_id: agent.id,
        source: "telegram_sessions",
        level: "notice",
        message: "Telegram interface reserved; connect a bot to activate it",
      },
    ].map((log) => ({
      ...log,
      message: sanitizeActivityLogMessage(log.message),
    })),
  );

  if (logsError) {
    throw logsError;
  }
}

async function insertAgentSettings(
  serviceClient: KyraSupabaseClient,
  workspaceId: string,
  agentId: string,
  settings: AgentSettings,
) {
  const { error } = await serviceClient.from("agent_settings").insert({
    agent_id: agentId,
    workspace_id: workspaceId,
    ...toAgentSettingsRow(settings),
  });

  if (error) {
    throw error;
  }
}

async function cleanupPartialAgent(
  serviceClient: KyraSupabaseClient,
  agentId: string | null,
) {
  if (!agentId) {
    return;
  }

  try {
    await serviceClient.from("agent_instances").delete().eq("id", agentId);
  } catch {
    // Preserve the original deploy error. A later reset can clean up if this best-effort delete fails.
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
      throw new HttpError(
        405,
        "method_not_allowed",
        "Use POST for deploy-agent.",
      );
    }

    const authorization = request.headers.get("Authorization") ?? "";

    if (!authorization.toLowerCase().startsWith("bearer ")) {
      throw new HttpError(
        401,
        "unauthorized",
        "A valid Supabase session is required.",
      );
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const limit = getDemoLimit();
    const body = await readDeployRequestBody(request);
    const templateId = assertTemplateId(body.templateId);
    const chain = assertChainTarget(body.chainKey, body.chainId);

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
      throw new HttpError(
        409,
        "quota_exceeded",
        `Agent limit reached (${used}/${limit}).`,
        {
          quota: {
            used,
            limit,
            remaining: 0,
          },
        },
      );
    }

    const template = await getTemplate(serviceClient, templateId);
    const allowedActions = readJsonArray(template.actions);
    const settingsValidation = validateAgentSettings(
      body.settings,
      allowedActions,
    );

    if (!settingsValidation.ok) {
      throw new HttpError(400, "invalid_settings", settingsValidation.message, {
        field: settingsValidation.field,
      });
    }

    const settings = settingsValidation.settings;
    const requestedActions = settings.enabledActions.length
      ? settings.enabledActions
      : normalizeStringArray(body.selectedActions);
    const filteredActions = requestedActions.length
      ? requestedActions.filter((action) => allowedActions.includes(action))
      : allowedActions;
    const selectedActions = filteredActions.length
      ? filteredActions
      : allowedActions;
    const agentName = normalizeAgentName(body.agentName, template);
    const agent = await insertAgent(
      serviceClient,
      workspace.id,
      template,
      user.id,
      agentName,
      chain,
    );
    let nextUsed = used + 1;

    try {
      const policy = await insertWalletPolicy(
        serviceClient,
        workspace.id,
        agent.id,
        selectedActions,
        chain,
      );

      await insertRelatedRecords(
        serviceClient,
        workspace,
        agent,
        template,
        policy,
      );
      await insertAgentSettings(serviceClient, workspace.id, agent.id, settings);

      // Scout leads with launch monitoring, so its digests start on. Best
      // effort: the owner can still turn them on with /launches on.
      if (template.id === "scout") {
        await serviceClient.from("agent_launch_subscriptions").insert({
          agent_id: agent.id,
          workspace_id: workspace.id,
          enabled: true,
          last_digest_at: new Date().toISOString(),
        });
      }

      try {
        nextUsed = await getAgentCount(serviceClient, workspace.id);
      } catch {
        nextUsed = used + 1;
      }
    } catch (error) {
      await cleanupPartialAgent(serviceClient, agent.id);
      throw error;
    }

    return jsonResponse(
      {
        ok: true,
        status: "saved",
        message: "Agent deployment persisted by deploy-agent function.",
        workspaceId: workspace.id,
        agentId: agent.id,
        publicSlug: agent.public_slug,
        publicPath: `/agents/${agent.public_slug}`,
        quota: {
          used: nextUsed,
          limit,
          remaining: Math.max(0, limit - nextUsed),
        },
        receipt: {
          template: template.name,
          agent: agent.display_name,
          telegram: agent.handle,
          wallet: "approval_required",
          chainKey: chain.key,
          chainId: chain.id,
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
        message: "Kyra could not deploy this agent safely.",
      },
      500,
    );
  }
});
