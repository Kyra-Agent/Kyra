import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, LoaderCircle, Unplug, WalletCards } from "lucide-react";
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
} from "wagmi";
import { appConfig } from "../config/appConfig";
import { currentProductChain } from "../config/productChains";
import {
  baseAccountConnectorId,
  bindingMatchesTarget,
  connectionMatchesBinding,
  createBaseAccountConnectionBinding,
  getBaseAccountConnectionFailureMessage,
  isBaseAccountConnectionTarget,
  maskBaseAccountAddress,
  type BaseAccountConnectionBinding,
  type BaseAccountConnectionFailureCode,
  type BaseAccountConnectionTarget,
} from "../types/baseAccountConnection";
import {
  ensureFreshAuthSession,
  type KyraAuthSession,
  type KyraAuthStatus,
} from "../services/supabaseAuthService";

interface BaseAccountConnectionPanelProps {
  session: KyraAuthSession | null;
  workspaceId: string | null;
  agentId: string | null;
  agentName: string | null;
  onConnectionStateChange?: (state: BaseAccountConnectionStatus) => void;
  onSessionChange: (
    session: KyraAuthSession | null,
    status: KyraAuthStatus,
    message: string,
  ) => void;
}

export interface BaseAccountConnectionStatus {
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

export function BaseAccountConnectionPanel({
  session,
  workspaceId,
  agentId,
  agentName,
  onConnectionStateChange,
  onSessionChange,
}: BaseAccountConnectionPanelProps) {
  const connection = useConnection();
  const connectors = useConnectors();
  const connectMutation = useConnect();
  const disconnectMutation = useDisconnect();
  const [binding, setBinding] = useState<BaseAccountConnectionBinding | null>(
    null,
  );
  const [uiState, setUiState] = useState<ConnectionUiState>("locked");
  const [message, setMessage] = useState(
    "Sign in and select a persisted agent before connecting.",
  );
  const requestSequenceRef = useRef(0);

  const target = useMemo<BaseAccountConnectionTarget | null>(() => {
    const candidate = {
      ownerUserId: session?.user.id,
      workspaceId: workspaceId ?? undefined,
      agentId: agentId ?? undefined,
    };

    return isBaseAccountConnectionTarget(candidate) ? candidate : null;
  }, [agentId, session?.user.id, workspaceId]);
  const targetKey = target
    ? `${target.ownerUserId}:${target.workspaceId}:${target.agentId}`
    : "locked";
  const connector = connectors.find((item) =>
    item.id === baseAccountConnectorId
  );
  const canConnect = Boolean(
    appConfig.integrations.walletConnection === "owner_click_only" &&
      target &&
      connector &&
      !connectMutation.isPending &&
      !disconnectMutation.isPending,
  );

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

    if (binding && (!target || !bindingMatchesTarget(binding, target))) {
      disconnectMutation.disconnect();
      setBinding(null);
      setUiState(target ? "ready" : "locked");
      setMessage(
        getBaseAccountConnectionFailureMessage("binding_changed"),
      );
      return;
    }

    if (!target && !binding) {
      setUiState("locked");
      setMessage(
        session
          ? getBaseAccountConnectionFailureMessage("agent_binding_required")
          : getBaseAccountConnectionFailureMessage("owner_session_required"),
      );
      return;
    }

    if (target && !binding && !connectMutation.isPending) {
      setUiState("ready");
      setMessage(
        "Connect this Base Account to the selected agent for this browser session.",
      );
    }
  }, [targetKey]);

  useEffect(() => {
    if (!binding) return;

    if (connection.status === "disconnected") {
      setBinding(null);
      setUiState(target ? "ready" : "locked");
      setMessage("Base Account disconnected from this browser session.");
      return;
    }

    if (
      connection.status === "connected" &&
      !connectionMatchesBinding(binding, {
        connectorId: connection.connector.id,
        chainId: connection.chainId,
        address: connection.address,
      })
    ) {
      disconnectMutation.disconnect();
      setBinding(null);
      setUiState("error");
      setMessage(
        getBaseAccountConnectionFailureMessage("binding_changed"),
      );
    }
  }, [
    binding,
    connection.status,
    connection.address,
    connection.chainId,
    connection.connector?.id,
  ]);

  async function handleConnect() {
    if (!session || !target || !connector || !canConnect) {
      setUiState("error");
      setMessage(
        !session
          ? getBaseAccountConnectionFailureMessage("owner_session_required")
          : !target
          ? getBaseAccountConnectionFailureMessage("agent_binding_required")
          : getBaseAccountConnectionFailureMessage("provider_unavailable"),
      );
      return;
    }

    const requestSequence = ++requestSequenceRef.current;
    setUiState("connecting");
    setMessage("Checking the owner session before opening Base Account...");

    const freshAuth = await ensureFreshAuthSession(session);

    if (requestSequence !== requestSequenceRef.current) return;

    if (!freshAuth.session) {
      onSessionChange(null, freshAuth.status, freshAuth.message);
      setUiState("error");
      setMessage(
        getBaseAccountConnectionFailureMessage("owner_session_required"),
      );
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
      setMessage(
        getBaseAccountConnectionFailureMessage("binding_changed"),
      );
      return;
    }

    try {
      setMessage("Waiting for explicit Base Account confirmation...");
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
        setMessage(
          getBaseAccountConnectionFailureMessage("network_mismatch"),
        );
        return;
      }

      const nextBinding = createBaseAccountConnectionBinding({
        ...target,
        address: result.accounts[0],
        chainId: result.chainId,
        connectorId: connector.id,
      });

      setBinding(nextBinding);
      setUiState("connected");
      setMessage(
        "Base Account connected to the selected agent. Signing and transactions remain disabled.",
      );
    } catch (error) {
      disconnectMutation.disconnect();
      setBinding(null);
      setUiState("error");
      setMessage(
        getBaseAccountConnectionFailureMessage(classifyConnectionError(error)),
      );
    }
  }

  function handleDisconnect() {
    requestSequenceRef.current += 1;
    setUiState("disconnecting");
    setMessage("Disconnecting Base Account from this browser session...");
    disconnectMutation.disconnect(undefined, {
      onSettled: () => {
        setBinding(null);
        setUiState(target ? "ready" : "locked");
        setMessage("Base Account disconnected from this browser session.");
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
          <small>Base Account connection</small>
          <strong>
            {binding
              ? maskBaseAccountAddress(binding.address)
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
          <strong>{binding ? "Base" : "Base required"}</strong>
        </span>
        <span>
          Storage
          <strong>Browser session only</strong>
        </span>
        <span>
          Execution
          <strong>Disabled</strong>
        </span>
      </div>

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
              Connect Base Account
            </button>
          )}
        <small>No signing, token approval, or transaction request is made.</small>
      </div>
    </div>
  );
}

function classifyConnectionError(
  error: unknown,
): BaseAccountConnectionFailureCode {
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
