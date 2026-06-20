import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

const baseline = readJson("docs/phase-7R-base-mcp-provider-baseline.json");

const blockerDescriptions = {
  protected_resource_metadata_unavailable:
    "Protected Resource Metadata is unavailable, so the exact MCP resource/audience is not verified.",
  wallet_authority_scopes_advertised:
    "The currently advertised scopes are wallet-authority scopes, not a verified least-privilege scope.",
  scope_to_tool_mapping_unverified:
    "The exact mapping from scope to MCP tools is not verified.",
  escalation_semantics_unverified:
    "Escalation semantics are not verified and must be treated as unsafe.",
  mcp_challenge_resource_metadata_missing:
    "The unauthenticated MCP challenge does not provide resource_metadata.",
  mcp_challenge_scope_missing:
    "The unauthenticated MCP challenge does not provide scope guidance.",
};

const missingEvidence = [
  "stable Protected Resource Metadata",
  "exact resource/audience identifier",
  "exact non-escalating scope",
  "exact scope-to-tool mapping",
  "tool ID and schema snapshot",
  "approval-link binding, expiry, cancellation, and replay behavior",
  "token expiry, refresh, rotation, revocation, and disconnect behavior",
  "owner consent copy naming owner, workspace, agent, scope, tools, chains, limits, storage, revocation, and Telegram prohibition",
];

const forbiddenUntilGo = [
  "official Base MCP OAuth start",
  "official Base MCP OAuth callback",
  "dynamic client registration",
  "access or refresh token storage",
  "authenticated official MCP session",
  "official MCP tool discovery",
  "official MCP tool invocation",
  "provider approval link creation",
  "Base Account prompt",
  "wallet signing",
  "transaction submission",
];

const allowedWork = [
  "run read-only provider monitor",
  "review public official Base MCP metadata and docs",
  "keep Telegram live read-only",
  "keep custom status bridge separate from official Base MCP",
  "maintain local audits and fail-closed gates",
];

const status = {
  phase: "Phase 7C official Base MCP provider contract",
  decision: baseline.decision,
  canStartPhase7D: false,
  officialBaseMcpAuthority: "blocked",
  telegramBoundary: "read-only",
  reason: "Official Base MCP provider contract is not yet safe for wallet authority.",
  observed: {
    issuer: baseline.authorization?.issuer ?? null,
    authorizationEndpointKnown: Boolean(baseline.authorization?.authorizationEndpoint),
    tokenEndpointKnown: Boolean(baseline.authorization?.tokenEndpoint),
    registrationEndpointKnown: Boolean(baseline.authorization?.registrationEndpoint),
    advertisedScopes: baseline.authorization?.scopes ?? [],
    protectedResourceMetadataAvailable: Boolean(
      baseline.protectedResources?.root?.available ||
        baseline.protectedResources?.mcpPath?.available,
    ),
    mcpChallengeRealm: baseline.mcpChallenge?.bearerRealm ?? null,
    mcpChallengeResourceMetadata: baseline.mcpChallenge?.resourceMetadata ?? null,
    mcpChallengeScopes: baseline.mcpChallenge?.scopes ?? [],
  },
  blockers: baseline.blockers.map((blocker) => ({
    code: blocker,
    description: blockerDescriptions[blocker] ?? "Unreviewed provider-contract blocker.",
  })),
  missingEvidence,
  forbiddenUntilGo,
  allowedWork,
  nextDecision:
    "Keep Phase 7C blocked until the missing evidence is verified and the owner explicitly approves the transition to Phase 7D.",
};

console.log(JSON.stringify(status, null, 2));
