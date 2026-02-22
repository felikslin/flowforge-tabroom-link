export interface FlowUser {
  email: string;
  name: string;
  token: string;
  person_id: string | null;
}

export interface RoundData {
  round: string;
  status: "current" | "complete" | "upcoming";
  opponent: string;
  school?: string;
  room: string;
  side?: string;
  judge?: string;
  start?: string;
  result?: string;
  points?: string;
}

export interface PairingRow {
  room: string;
  aff: string;
  neg: string;
  judge: string;
  isMe?: boolean;
}

export type TabId =
  | "rounds"
  | "pairings"
  | "judge"
  | "nav"
  | "results"
  | "nearby"
  | "chat";
