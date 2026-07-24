import { type OwnershipLookupClient } from "../telegram-connect/core.ts";
import type {
  ChainActionAgentOwnershipRecord,
  ChainActionPrepareDependencies,
} from "./core.ts";
import { createChainStatusCheckAdapter } from "./provider-adapter.ts";
import {
  type ChainActionRateLimitRpcClient,
  createChainActionRateLimitChecker,
} from "./rate-limit.ts";
import { createChainActionPrepareRuntimeConfig } from "./runtime-config.ts";
import {
  type ChainPreparedActionStorageClient,
  createChainPreparedActionStorageAdapter,
} from "./storage-adapter.ts";

type ChainActionServiceClient =
  & OwnershipLookupClient
  & ChainActionRateLimitRpcClient
  & ChainPreparedActionStorageClient;

export interface ChainActionDependencyOptions {
  getEnv: (key: string) => string;
  getOptionalEnv: (key: string) => string;
  getUser: NonNullable<ChainActionPrepareDependencies["getUser"]>;
  createServiceClient: (
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<ChainActionServiceClient> | ChainActionServiceClient;
}

interface ChainAgentRow {
  id: string;
  workspace_id: string;
  network: ChainActionAgentOwnershipRecord["chainKey"];
  chain_action_status: ChainActionAgentOwnershipRecord["chainActionStatus"];
}

interface ChainWorkspaceRow {
  id: string;
  owner_user_id: string;
}

export async function lookupChainActionAgentOwnership(
  serviceClient: OwnershipLookupClient,
  agentId: string,
): Promise<ChainActionAgentOwnershipRecord | null> {
  const { data: agent, error: agentError } = await serviceClient
    .from("agent_instances")
    .select("id,workspace_id,network,chain_action_status")
    .eq("id", agentId)
    .maybeSingle<ChainAgentRow>();
  if (agentError) throw agentError;
  if (!agent) return null;
  if (
    !["robinhood_mainnet", "robinhood_testnet"].includes(agent.network) ||
    !["disabled", "ready", "active", "paused"].includes(
      agent.chain_action_status,
    )
  ) {
    throw new Error("Agent chain identity is invalid.");
  }

  const { data: workspace, error: workspaceError } = await serviceClient
    .from("workspaces")
    .select("id,owner_user_id")
    .eq("id", agent.workspace_id)
    .maybeSingle<ChainWorkspaceRow>();
  if (workspaceError) throw workspaceError;
  if (!workspace || workspace.id !== agent.workspace_id) {
    throw new Error("Ownership workspace was not found.");
  }

  return {
    agentId: agent.id,
    ownerUserId: workspace.owner_user_id,
    workspaceId: workspace.id,
    chainKey: agent.network,
    chainActionStatus: agent.chain_action_status,
  };
}

export function createChainActionDependenciesFromOptions(
  options: ChainActionDependencyOptions,
): ChainActionPrepareDependencies {
  const runtimeConfig = createChainActionPrepareRuntimeConfig(
    options.getOptionalEnv,
  );
  const dependencies: ChainActionPrepareDependencies = { runtimeConfig };
  if (!runtimeConfig.enabled) return dependencies;

  dependencies.getEnv = options.getEnv;
  dependencies.getUser = options.getUser;
  dependencies.prepareChainAction = createChainStatusCheckAdapter();

  let serviceClientPromise: Promise<ChainActionServiceClient> | null = null;
  const getServiceClient = () => {
    serviceClientPromise ??= Promise.resolve(options.createServiceClient(
      options.getEnv("SUPABASE_URL"),
      options.getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    ));
    return serviceClientPromise;
  };

  dependencies.lookupAgentOwnership = async (agentId) =>
    await lookupChainActionAgentOwnership(await getServiceClient(), agentId);
  dependencies.checkRateLimit = async (input) =>
    await createChainActionRateLimitChecker(await getServiceClient())(input);
  dependencies.storePreparedAction = async (input) =>
    await createChainPreparedActionStorageAdapter(await getServiceClient())(
      input,
    );

  return dependencies;
}
