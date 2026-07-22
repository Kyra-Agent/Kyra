import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, LoaderCircle, Unplug, WalletCards } from "lucide-react";
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
} from "wagmi";
import { appConfig } from "../config/appConfig";
import {
  currentProductChain,
  type ProductChainKey,
} from "../config/productChains";
import {
  createOwnerWalletConnectionBinding,
  getOwnerWalletConnectionFailureMessage,
  isOwnerWalletConnectionTarget,
  maskOwnerWalletAddress,
  ownerWalletConnectorType,
  walletBindingMatchesTarget,
  walletConnectionMatchesBinding,
  type OwnerWalletConnectionBinding,
  type OwnerWalletConnectionFailureCode,
  type OwnerWalletConnectionTarget,
} from "../types/ownerWalletConnection";
import {
  ensureFreshAuthSession,
  type KyraAuthSession,
  type KyraAuthStatus,
} from "../services/supabaseAuthService";

interface OwnerWalletConnectionPanelProps {
  session: KyraAuthSession | null;
  workspaceId: string | null;
  agentId: string | null;
  agentChainKey: ProductChainKey | null;
  agentName: string | null;
  onConnectionStateChange?: (state: OwnerWalletConnectionStatus) => void;
  onSessionChange: (
    session: KyraAuthSession | null,
    status: KyraAuthStatus,
    message: string,
  ) => void;
}

export interface OwnerWalletConnectionStatus {
  connected: boolean;
  address: `0x${string}` | null;
  chainId: number | null;
  connectorId: string | null;
}

type ConnectionUiState =
  | "locked"
  | "ready"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

export function OwnerWalletConnectionPanel({
  session,
  workspaceId,
  agentId,
  agentChainKey,
  agentName,
  onConnectionStateChange,
  onSessionChange,
}: OwnerWalletConnectionPanelProps) {
  const connection = useConnection();
  const connectors = useConnectors();
  const connectMutation = useConnect();
  const disconnectMutation = useDisconnect();
  const [binding, setBinding] = useState<OwnerWalletConnectionBinding | null>(
    null,
  );
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(
    null,
  );
  const [uiState, setUiState] = useState<ConnectionUiState>("locked");
  const [message, setMessage] = useState(
    "Sign in and select a persisted agent before connecting a wallet.",
  );
  const requestSequenceRef = useRef(0);
  const agentChainMatchesRuntime =
    agentChainKey === currentProductChain.key;

  const target = useMemo<OwnerWalletConnectionTarget | null>(() => {
    if (!agentChainMatchesRuntime) {
      return null;
    }

    const candidate = {
      ownerUserId: session?.user.id,
      workspaceId: workspaceId ?? undefined,
      agentId: agentId ?? undefined,
      sessionExpiresAt: session?.expiresAt,
    };

    return isOwnerWalletConnectionTarget(candidate) ? candidate : null;
  }, [
    agentChainMatchesRuntime,
    agentId,
    session?.expiresAt,
    session?.user.id,
    workspaceId,
  ]);
  const targetKey = target
    ? `${target.ownerUserId}:${target.workspaceId}:${target.agentId}:${target.sessionExpiresAt}`
    : "locked";
  const walletConnectors = connectors.filter((item) =>
    item.type === ownerWalletConnectorType
  );
  const connector = walletConnectors.find((item) =>
    item.id === selectedConnectorId
  ) ?? walletConnectors[0];
  const canConnect = Boolean(
    appConfig.integrations.walletConnection === "owner_click_only" &&
      target &&
      agentChainMatchesRuntime &&
      connector &&
      !connectMutation.isPending &&
      !disconnectMutation.isPending,
  );

  useEffect(() => {
    if (!selectedConnectorId && walletConnectors[0]) {
      setSelectedConnectorId(walletConnectors[0].id);
      return;
    }

    if (
      selectedConnectorId &&
      !walletConnectors.some((item) => item.id === selectedConnectorId)
    ) {
      setSelectedConnectorId(walletConnectors[0]?.id ?? null);
    }
  }, [selectedConnectorId, walletConnectors]);

  useEffect(() => {
    onConnectionStateChange?.({
      connected: Boolean(binding),
      address: binding?.address ?? null,
      chainId: binding?.chainId ?? null,
      connectorId: binding?.connectorId ?? null,
    });
  }, [binding, onConnectionStateChange]);

  useEffect(() => {
    requestSequenceRef.current += 1;

    if (binding && (!target || !walletBindingMatchesTarget(binding, target))) {
      disconnectMutation.disconnect();
      setBinding(null);
      setUiState(target ? "ready" : "locked");
      setMessage(getOwnerWalletConnectionFailureMessage("binding_changed"));
      return;
    }

    if (!target && !binding) {
      setUiState("locked");
      setMessage(
        agentId && !agentChainMatchesRuntime
          ? "Selected agent belongs to another chain. Choose an agent deployed for " +
            currentProductChain.name + "."
          : !session
          ? getOwnerWalletConnectionFailureMessage("owner_session_required")
          : getOwnerWalletConnectionFailureMessage("agent_binding_required"),
      );
      return;
    }

    if (target && !binding && !connectMutation.isPending) {
      setUiState("ready");
      setMessage(
        `Connect an EVM wallet to this agent on ${currentProductChain.name}.`,
      );
    }
  }, [
    agentChainMatchesRuntime,
    agentId,
    binding,
    session,
    targetKey,
  ]);

  useEffect(() => {
    if (!binding) return;

    if (connection.status === "disconnected") {
      setBinding(null);
      setUiState(target ? "ready" : "locked");
      setMessage("Wallet disconnected from this browser session.");
      return;
    }

    if (
      connection.status === "connected" &&
      !walletConnectionMatchesBinding(binding, {
        connectorId: connection.connector.id,
        connectorType: connection.connector.type,
        chainId: connection.chainId,
        address: connection.address,
      })
    ) {
      disconnectMutation.disconnect();
      setBinding(null);
      setUiState("error");
      setMessage(getOwnerWalletConnectionFailureMessage("binding_changed"));
    }
  }, [
    binding,
    connection.status,
    connection.address,
    connection.chainId,
    connection.connector?.id,
    connection.connector?.type,
  ]);

  async function handleConnect() {
    if (!session || !target || !connector || !canConnect) {
    if (agentId && !agentChainMatchesRuntime) {
      setUiState("error");
      setMessage(
        "Selected agent is not eligible for " + currentProductChain.name + ".",
      );
      return;
    }

      setUiState("error");
      setMessage(
        !session
          ? getOwnerWalletConnectionFailureMessage("owner_session_required")
          : !target
          ? getOwnerWalletConnectionFailureMessage(
            workspaceId && agentId
              ? "owner_session_required"
              : "agent_binding_required",
          )
          : getOwnerWalletConnectionFailureMessage("provider_unavailable"),
      );
      return;
    }

    const requestSequence = ++requestSequenceRef.current;
    setUiState("connecting");
    setMessage("Checking the owner session before opening the wallet...");

    const freshAuth = await ensureFreshAuthSession(session);

    if (requestSequence !== requestSequenceRef.current) return;

    if (!freshAuth.session) {
      onSessionChange(null, freshAuth.status, freshAuth.message);
      setUiState("error");
      setMessage(getOwnerWalletConnectionFailureMessage("owner_session_required"));
      return;
    }

    const freshTargetCandidate = {
      ownerUserId: freshAuth.session.user.id,
      workspaceId: target.workspaceId,
      agentId: target.agentId,
      sessionExpiresAt: freshAuth.session.expiresAt,
    };

    if (!isOwnerWalletConnectionTarget(freshTargetCandidate)) {
      setUiState("error");
      setMessage(getOwnerWalletConnectionFailureMessage("owner_session_required"));
      return;
    }

    if (
      freshAuth.session.user.id !== target.ownerUserId ||
      freshAuth.session.accessToken !== session.accessToken ||
      freshAuth.session.expiresAt !== session.expiresAt
    ) {
      onSessionChange(freshAuth.session, freshAuth.status, freshAuth.message);
    }

    if (freshAuth.session.user.id !== target.ownerUserId) {
      setUiState("error");
      setMessage(getOwnerWalletConnectionFailureMessage("binding_changed"));
      return;
    }

    try {
      setMessage(`Waiting for explicit ${connector.name} confirmation...`);
      const result = await connectMutation.connectAsync({
        connector,
        chainId: currentProductChain.id,
      });

      if (requestSequence !== requestSequenceRef.current) {
        disconnectMutation.disconnect();
        return;
      }

      if (result.chainId !== currentProductChain.id) {
        disconnectMutation.disconnect();
        setBinding(null);
        setUiState("error");
        setMessage(getOwnerWalletConnectionFailureMessage("network_mismatch"));
        return;
      }

      const nextBinding = createOwnerWalletConnectionBinding({
        ...freshTargetCandidate,
        address: result.accounts[0],
        chainId: result.chainId,
        connectorId: connector.id,
        connectorType: connector.type,
      });

      setBinding(nextBinding);
      setUiState("connected");
      setMessage(
        "Wallet connected to the selected agent. Signing and transactions remain disabled.",
      );
    } catch (error) {
      disconnectMutation.disconnect();
      setBinding(null);
      setUiState("error");
      setMessage(
        getOwnerWalletConnectionFailureMessage(classifyConnectionError(error)),
      );
    }
  }

  function handleDisconnect() {
    requestSequenceRef.current += 1;
    setUiState("disconnecting");
    setMessage("Disconnecting wallet from this browser session...");
    disconnectMutation.disconnect(undefined, {
      onSettled: () => {
        setBinding(null);
        setUiState(target ? "ready" : "locked");
        setMessage("Wallet disconnected from this browser session.");
      },
    });
  }

  return (
    <div className={`base-account-connection connection-${uiState}`}>
      <div className="base-account-connection-header">
        <span className="queue-icon">
          <WalletCards size={16} />
        </span>
        <div>
          <small>Owner wallet connection</small>
          <strong>
            {binding
              ? maskOwnerWalletAddress(binding.address)
              : target
              ? "Ready for owner action"
              : "Connection locked"}
          </strong>
        </div>
        <span className="base-account-state">{formatUiState(uiState)}</span>
      </div>

      <div className="base-account-binding-grid">
        <span>
          Agent
          <strong>{agentName ?? "No persisted agent"}</strong>
        </span>
        <span>
          Network
          <strong>
            {agentChainMatchesRuntime
              ? currentProductChain.name
              : "Agent chain mismatch"}
          </strong>
        </span>
        <span>
          Storage
          <strong>Browser memory only</strong>
        </span>
        <span>
          Execution
          <strong>Disabled</strong>
        </span>
      </div>

      {walletConnectors.length > 1 && !binding && (
        <label className="owner-wallet-provider-select">
          Wallet provider
          <select
            value={connector?.id ?? ""}
            onChange={(event) => setSelectedConnectorId(event.target.value)}
            disabled={connectMutation.isPending || disconnectMutation.isPending}
          >
            {walletConnectors.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      )}

      <p aria-live="polite">{message}</p>

      <div className="base-account-actions">
        {binding
          ? (
            <button
              className="button button-ghost"
              type="button"
              onClick={handleDisconnect}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending
                ? <LoaderCircle className="spin-icon" size={16} />
                : <Unplug size={16} />}
              Disconnect
            </button>
          )
          : (
            <button
              className="button button-primary"
              type="button"
              onClick={() => void handleConnect()}
              disabled={!canConnect}
            >
              {connectMutation.isPending
                ? <LoaderCircle className="spin-icon" size={16} />
                : <Link2 size={16} />}
              Connect wallet
            </button>
          )}
        <small>No signing, token approval, or transaction request is made.</small>
      </div>
    </div>
  );
}

function classifyConnectionError(
  error: unknown,
): OwnerWalletConnectionFailureCode {
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    typeof error.name === "string" &&
    error.name.toLowerCase().includes("userrejected")
  ) {
    return "user_rejected";
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 4001
  ) {
    return "user_rejected";
  }

  return "unknown";
}

function formatUiState(state: ConnectionUiState) {
  return state.replace(/_/gu, " ");
}
