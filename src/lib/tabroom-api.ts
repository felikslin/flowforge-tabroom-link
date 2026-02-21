import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "tabroom-proxy";

async function callTabroom<T = unknown>(
  action: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    `${FUNCTION_NAME}/${action}`,
    { body }
  );

  if (error) {
    throw new Error(error.message || "Tabroom proxy request failed");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}

// ─── Types ───────────────────────────────────────────────

export interface TabroomSession {
  success: boolean;
  token: string;
  person_id: string | null;
  name: string;
  email: string;
}

export interface TabroomTournament {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface TabroomCoinFlip {
  available: boolean;
  deadline?: string;
  countdown_seconds?: number;
  duration_minutes?: number;
  status?: "pending" | "active" | "completed";
  assigned_side?: "AFF" | "NEG";
  caller?: string;
}

export interface TabroomPairing {
  room: string;
  aff: string;
  neg: string;
  judge: string;
  [key: string]: unknown;
}

export interface TabroomJudgeInfo {
  judge_id?: string;
  name: string;
  paradigm: string | null;
  html_preview?: string;
}

// ─── API Functions ───────────────────────────────────────

export async function tabroomLogin(
  email: string,
  password: string
): Promise<TabroomSession> {
  return callTabroom<TabroomSession>("login", { email, password });
}

export async function tabroomGetMyTournaments(
  token: string
): Promise<{ tournaments: TabroomTournament[]; total: number }> {
  return callTabroom("my-tournaments", { token });
}

export async function tabroomGetPairings(
  token: string,
  tournId: string,
  eventId?: string,
  roundId?: string
): Promise<{ pairings: TabroomPairing[]; total: number; coin_flip?: TabroomCoinFlip }> {
  return callTabroom("pairings", {
    token,
    tourn_id: tournId,
    event_id: eventId,
    round_id: roundId,
  });
}

export async function tabroomGetJudge(
  judgeId?: string,
  judgeName?: string
): Promise<TabroomJudgeInfo> {
  return callTabroom<TabroomJudgeInfo>("judge", {
    judge_id: judgeId,
    judge_name: judgeName,
  });
}

export async function tabroomGetBallots(
  token: string,
  tournId: string,
  entryId?: string
) {
  return callTabroom("ballots", {
    token,
    tourn_id: tournId,
    entry_id: entryId,
  });
}
