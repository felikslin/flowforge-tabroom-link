import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "tabroom-proxy";

async function callTabroom<T = unknown>(
  action: string,
  body: Record<string, unknown>
): Promise<T> {
  // Append action to the function path
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
  person_id: string;
  name: string;
  email: string;
  session: string;
  raw?: unknown;
}

export interface TabroomTournament {
  id: string;
  name: string;
  start?: string;
  end?: string;
  location?: string;
  [key: string]: unknown;
}

export interface TabroomPairing {
  room?: string;
  aff?: string;
  neg?: string;
  judge?: string;
  [key: string]: unknown;
}

export interface TabroomJudgeInfo {
  judge_id?: string;
  name: string;
  paradigm: string | null;
  raw_html?: string;
}

// ─── API Functions ───────────────────────────────────────

export async function tabroomLogin(
  email: string,
  password: string
): Promise<TabroomSession> {
  return callTabroom<TabroomSession>("login", { email, password });
}

export async function tabroomGetMyTournaments(
  session: string,
  personId: string
): Promise<TabroomTournament[]> {
  return callTabroom<TabroomTournament[]>("my-tournaments", {
    session,
    person_id: personId,
  });
}

export async function tabroomGetPairings(
  session: string,
  tournId: string,
  eventId?: string,
  roundId?: string
): Promise<TabroomPairing[]> {
  return callTabroom<TabroomPairing[]>("pairings", {
    session,
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
  session: string,
  tournId: string,
  entryId?: string
) {
  return callTabroom("ballots", {
    session,
    tourn_id: tournId,
    entry_id: entryId,
  });
}
