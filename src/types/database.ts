export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type KyraChainKey =
  | "base"
  | "robinhood_mainnet"
  | "robinhood_testnet";

export interface KyraDatabase {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          owner_user_id: string;
          name: string;
          mode: "demo" | "live";
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          name: string;
          mode?: "demo" | "live";
          created_at?: string;
        };
        Update: Partial<KyraDatabase["public"]["Tables"]["workspaces"]["Insert"]>;
      };
      agent_templates: {
        Row: {
          id: string;
          name: string;
          role: string;
          status: "mvp" | "advanced" | "coming-soon";
          summary: string;
          best_for: string;
          actions: Json;
          modules: Json;
          terminal_seed: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          role: string;
          status: "mvp" | "advanced" | "coming-soon";
          summary: string;
          best_for: string;
          actions?: Json;
          modules?: Json;
          terminal_seed?: string;
          created_at?: string;
        };
        Update: Partial<KyraDatabase["public"]["Tables"]["agent_templates"]["Insert"]>;
      };
      agent_instances: {
        Row: {
          id: string;
          workspace_id: string;
          template_id: string;
          display_name: string;
          handle: string;
          public_slug: string;
          status: "online" | "draft" | "paused";
          mode: "demo" | "live";
          network: KyraChainKey;
          chain_action_status: "disabled" | "ready" | "active" | "paused";
          telegram_status: "mocked" | "active" | "queued" | "review";
          base_mcp_status: "mocked" | "active" | "queued" | "review";
          approval_policy_id: string | null;
          created_at: string;
          last_sync_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          template_id: string;
          display_name: string;
          handle: string;
          public_slug: string;
          status?: "online" | "draft" | "paused";
          mode?: "demo" | "live";
          network?: KyraChainKey;
          chain_action_status?: "disabled" | "ready" | "active" | "paused";
          telegram_status?: "mocked" | "active" | "queued" | "review";
          base_mcp_status?: "mocked" | "active" | "queued" | "review";
          approval_policy_id?: string | null;
          created_at?: string;
          last_sync_at?: string;
        };
        Update: Partial<KyraDatabase["public"]["Tables"]["agent_instances"]["Insert"]>;
      };
      wallet_policies: {
        Row: {
          id: string;
          workspace_id: string;
          agent_id: string;
          wallet_label: string;
          wallet_address: string | null;
          daily_limit_usdc: number | null;
          approval_required: boolean;
          allowed_actions: Json;
          status: "active" | "simulated" | "paused";
          chain_key: KyraChainKey;
          chain_id: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          agent_id: string;
          wallet_label: string;
          wallet_address?: string | null;
          daily_limit_usdc?: number | null;
          approval_required?: boolean;
          allowed_actions?: Json;
          status?: "active" | "simulated" | "paused";
          chain_key?: KyraChainKey;
          chain_id?: number;
          created_at?: string;
        };
        Update: Partial<KyraDatabase["public"]["Tables"]["wallet_policies"]["Insert"]>;
      };
      approval_requests: {
        Row: {
          id: string;
          workspace_id: string;
          agent_id: string;
          scenario_id: string | null;
          title: string;
          command: string;
          route: string;
          risk: "normal" | "review" | "read-only";
          status: "waiting_wallet" | "read_only_ready" | "review_required" | "approved" | "rejected";
          fee_payer: "connected_wallet";
          requires_wallet: boolean;
          prepared_tx: Json | null;
          tx_hash: string | null;
          created_at: string;
          resolved_at: string | null;
          chain_key: KyraChainKey;
          chain_id: number;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          agent_id: string;
          scenario_id?: string | null;
          title: string;
          command: string;
          route: string;
          risk: "normal" | "review" | "read-only";
          status?: "waiting_wallet" | "read_only_ready" | "review_required" | "approved" | "rejected";
          fee_payer?: "connected_wallet";
          requires_wallet?: boolean;
          prepared_tx?: Json | null;
          tx_hash?: string | null;
          created_at?: string;
          resolved_at?: string | null;
          chain_key?: KyraChainKey;
          chain_id?: number;
        };
        Update: Partial<KyraDatabase["public"]["Tables"]["approval_requests"]["Insert"]>;
      };
      activity_logs: {
        Row: {
          id: string;
          workspace_id: string;
          agent_id: string | null;
          source: "agent_instances" | "telegram_sessions" | "base_mcp_routes" | "approval_requests";
          level: "info" | "notice" | "warning";
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          agent_id?: string | null;
          source: "agent_instances" | "telegram_sessions" | "base_mcp_routes" | "approval_requests";
          level?: "info" | "notice" | "warning";
          message: string;
          created_at?: string;
        };
        Update: Partial<KyraDatabase["public"]["Tables"]["activity_logs"]["Insert"]>;
      };
      telegram_sessions: {
        Row: {
          id: string;
          agent_id: string;
          bot_handle: string | null;
          webhook_status: "mocked" | "queued" | "active" | "paused";
          token_secret_ref: string | null;
          created_at: string;
          last_event_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          bot_handle?: string | null;
          webhook_status?: "mocked" | "queued" | "active" | "paused";
          token_secret_ref?: string | null;
          created_at?: string;
          last_event_at?: string | null;
        };
        Update: Partial<KyraDatabase["public"]["Tables"]["telegram_sessions"]["Insert"]>;
      };
    };
  };
}

export type KyraTableName = keyof KyraDatabase["public"]["Tables"];
