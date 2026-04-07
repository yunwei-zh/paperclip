import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  companyHeartbeatFrequencyMultiplier,
  HEARTBEAT_FREQUENCY_SCALE_MAX,
  HEARTBEAT_FREQUENCY_SCALE_MIN,
} from "@paperclipai/shared";
import { companiesApi } from "../api/companies";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../context/ToastContext";
import { Timer } from "lucide-react";

type Props = {
  companyId: string;
};

const SAVE_DEBOUNCE_MS = 450;

export function HeartbeatFrequencyCard({ companyId }: Props) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { data: company, isLoading } = useQuery({
    queryKey: queryKeys.companies.detail(companyId),
    queryFn: () => companiesApi.get(companyId),
    enabled: !!companyId,
  });

  const [draft, setDraft] = useState<number | null>(null);
  const savedScale = company?.heartbeatFrequencyScalePercent;
  const value = draft ?? savedScale ?? 50;
  const mult = companyHeartbeatFrequencyMultiplier(value);

  useEffect(() => {
    setDraft(null);
  }, [savedScale, companyId]);

  const { mutate, isPending } = useMutation({
    mutationFn: (heartbeatFrequencyScalePercent: number) =>
      companiesApi.update(companyId, { heartbeatFrequencyScalePercent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.detail(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(companyId) });
    },
    onError: (err: Error) => {
      pushToast({
        title: "Could not save heartbeat frequency",
        body: err.message,
        tone: "error",
      });
    },
  });

  useEffect(() => {
    if (savedScale === undefined) return;
    const target = draft ?? savedScale;
    if (target === savedScale) return;
    const id = window.setTimeout(() => {
      mutate(target);
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [draft, savedScale, mutate]);

  if (isLoading || !company) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm animate-pulse h-[120px]" />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-muted p-1.5">
          <Timer className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Timer heartbeat frequency</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Applies to agents with timer heartbeats enabled. Relative rate ≈{" "}
              <span className="font-medium tabular-nums text-foreground">{mult.toFixed(2)}×</span>{" "}
              (50 = default).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-12 shrink-0">
              Slower
            </span>
            <input
              type="range"
              min={HEARTBEAT_FREQUENCY_SCALE_MIN}
              max={HEARTBEAT_FREQUENCY_SCALE_MAX}
              value={value}
              disabled={isPending}
              onChange={(e) => setDraft(Number(e.target.value))}
              className="flex-1 h-2 accent-primary cursor-pointer disabled:opacity-50"
              aria-label="Timer heartbeat frequency"
            />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-12 text-right shrink-0">
              Faster
            </span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{HEARTBEAT_FREQUENCY_SCALE_MIN}</span>
            <span className="font-medium text-foreground">{value}</span>
            <span>{HEARTBEAT_FREQUENCY_SCALE_MAX}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
