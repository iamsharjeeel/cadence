"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";
import { DEFAULT_ORG_SETTINGS, type OrgSettings } from "@/types/org-settings";

type OrgSettingsContextValue = {
  settings: OrgSettings | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const OrgSettingsContext = createContext<OrgSettingsContextValue | null>(null);

export function OrgSettingsProvider({
  orgId,
  canLoad,
  children,
}: {
  orgId: string | null;
  /** Owner/admin in org workspace — RPC requires manager+ */
  canLoad: boolean;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(Boolean(orgId && canLoad));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!orgId || !canLoad) {
      setSettings(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc(
      "get_or_create_org_settings",
      { p_org_id: orgId },
    );

    if (rpcError) {
      setError(rpcError.message);
      setSettings(null);
    } else if (data) {
      setSettings(data as OrgSettings);
    } else {
      setSettings({
        id: "",
        org_id: orgId,
        created_at: "",
        updated_at: "",
        ...DEFAULT_ORG_SETTINGS,
      });
    }
    setLoading(false);
  }, [orgId, canLoad]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ settings, loading, error, refresh }),
    [settings, loading, error, refresh],
  );

  return (
    <OrgSettingsContext.Provider value={value}>
      {children}
    </OrgSettingsContext.Provider>
  );
}

export function useOrgSettings(): OrgSettingsContextValue {
  const ctx = useContext(OrgSettingsContext);
  if (!ctx) {
    return {
      settings: null,
      loading: false,
      error: null,
      refresh: async () => {},
    };
  }
  return ctx;
}
