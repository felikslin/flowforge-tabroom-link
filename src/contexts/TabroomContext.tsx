import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { FlowUser } from "@/types/flow";
import {
  tabroomGetMyTournaments,
  tabroomGetPairings,
  tabroomGetBallots,
  tabroomGetJudge,
  tabroomGetMyRounds,
  tabroomGetEntries,
  tabroomGetPastResults,
  tabroomGetUpcoming,
  type TabroomTournament,
  type TabroomPairing,
  type TabroomJudgeInfo,
  type TabroomCoinFlip,
  type TabroomRound,
  type TabroomPastResult,
} from "@/lib/tabroom-api";

interface TabroomState {
  user: FlowUser;
  tournaments: TabroomTournament[];
  selectedTournament: TabroomTournament | null;
  pairings: TabroomPairing[];
  coinFlip: TabroomCoinFlip | null;
  ballots: TabroomRound[];
  myRounds: TabroomRound[];
  myRecord: { wins: number; losses: number };
  judgeInfo: TabroomJudgeInfo | null;
  entries: TabroomTournament[];
  pastResults: TabroomPastResult[];
  upcomingTournaments: TabroomTournament[];
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  selectTournament: (t: TabroomTournament) => void;
  refreshPairings: () => void;
  refreshBallots: () => void;
  refreshMyRounds: () => void;
  refreshEntries: () => void;
  refreshPastResults: () => void;
  refreshUpcoming: () => void;
  lookupJudge: (name?: string, id?: string) => void;
  htmlPreviews: Record<string, string | undefined>;
}

const TabroomContext = createContext<TabroomState | null>(null);

export function useTabroom(): TabroomState {
  const ctx = useContext(TabroomContext);
  if (!ctx) throw new Error("useTabroom must be inside TabroomProvider");
  return ctx;
}

export function TabroomProvider({ user, children }: { user: FlowUser; children: ReactNode }) {
  const [tournaments, setTournaments] = useState<TabroomTournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<TabroomTournament | null>(null);
  const [pairings, setPairings] = useState<TabroomPairing[]>([]);
  const [coinFlip, setCoinFlip] = useState<TabroomCoinFlip | null>(null);
  const [ballots, setBallots] = useState<TabroomRound[]>([]);
  const [myRounds, setMyRounds] = useState<TabroomRound[]>([]);
  const [myRecord, setMyRecord] = useState({ wins: 0, losses: 0 });
  const [judgeInfo, setJudgeInfo] = useState<TabroomJudgeInfo | null>(null);
  const [entries, setEntries] = useState<TabroomTournament[]>([]);
  const [pastResults, setPastResults] = useState<TabroomPastResult[]>([]);
  const [upcomingTournaments, setUpcomingTournaments] = useState<TabroomTournament[]>([]);
  const [htmlPreviews, setHtmlPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const setLoad = (key: string, val: boolean) => setLoading((l) => ({ ...l, [key]: val }));
  const setErr = (key: string, val: string | null) => setErrors((e) => ({ ...e, [key]: val }));

  // Fetch tournaments on mount
  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoad("tournaments", true);
      setErr("tournaments", null);
      try {
        const res = await tabroomGetMyTournaments(user.token);
        if (!cancelled) {
          setTournaments(res.tournaments || []);
          if (res.tournaments?.length > 0 && !selectedTournament) {
            setSelectedTournament(res.tournaments[0]);
          }
        }
      } catch (err: any) {
        if (!cancelled) setErr("tournaments", err.message);
      } finally {
        if (!cancelled) setLoad("tournaments", false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [user.token]);

  const selectTournament = useCallback((t: TabroomTournament) => setSelectedTournament(t), []);

  // Pairings
  const refreshPairings = useCallback(async () => {
    if (!selectedTournament) return;
    setLoad("pairings", true); setErr("pairings", null);
    try {
      const res = await tabroomGetPairings(user.token, selectedTournament.id);
      setPairings(res.pairings || []);
      setCoinFlip(res.coin_flip || null);
    } catch (err: any) { setErr("pairings", err.message); }
    finally { setLoad("pairings", false); }
  }, [user.token, selectedTournament]);

  useEffect(() => { if (selectedTournament) refreshPairings(); }, [selectedTournament, refreshPairings]);

  // My Rounds
  const refreshMyRounds = useCallback(async () => {
    if (!selectedTournament) return;
    setLoad("rounds", true); setErr("rounds", null);
    try {
      const res = await tabroomGetMyRounds(user.token, selectedTournament.id);
      setMyRounds(res.rounds || []);
      setMyRecord(res.record || { wins: 0, losses: 0 });
      setHtmlPreviews((h) => ({ ...h, rounds: res.html_preview }));
    } catch (err: any) { setErr("rounds", err.message); }
    finally { setLoad("rounds", false); }
  }, [user.token, selectedTournament]);

  useEffect(() => { if (selectedTournament) refreshMyRounds(); }, [selectedTournament, refreshMyRounds]);

  // Ballots
  const refreshBallots = useCallback(async () => {
    if (!selectedTournament) return;
    setLoad("ballots", true); setErr("ballots", null);
    try {
      const res = await tabroomGetBallots(user.token, selectedTournament.id);
      setBallots(res.rounds || []);
      setHtmlPreviews((h) => ({ ...h, ballots: res.html_preview }));
    } catch (err: any) { setErr("ballots", err.message); }
    finally { setLoad("ballots", false); }
  }, [user.token, selectedTournament]);

  useEffect(() => { if (selectedTournament) refreshBallots(); }, [selectedTournament, refreshBallots]);

  // Entries
  const refreshEntries = useCallback(async () => {
    setLoad("entries", true); setErr("entries", null);
    try {
      const res = await tabroomGetEntries(user.token);
      setEntries(res.entries || []);
    } catch (err: any) { setErr("entries", err.message); }
    finally { setLoad("entries", false); }
  }, [user.token]);

  useEffect(() => { refreshEntries(); }, [refreshEntries]);

  // Past results
  const refreshPastResults = useCallback(async () => {
    setLoad("pastResults", true); setErr("pastResults", null);
    try {
      const res = await tabroomGetPastResults(user.person_id || undefined, user.token);
      setPastResults(res.results || []);
    } catch (err: any) { setErr("pastResults", err.message); }
    finally { setLoad("pastResults", false); }
  }, [user.person_id, user.token]);

  // Upcoming
  const refreshUpcoming = useCallback(async () => {
    setLoad("upcoming", true); setErr("upcoming", null);
    try {
      const res = await tabroomGetUpcoming();
      setUpcomingTournaments(res.tournaments || []);
    } catch (err: any) { setErr("upcoming", err.message); }
    finally { setLoad("upcoming", false); }
  }, []);

  const lookupJudge = useCallback(async (name?: string, id?: string) => {
    setLoad("judge", true); setErr("judge", null);
    try {
      const res = await tabroomGetJudge(id, name, user.token);
      setJudgeInfo(res);
    } catch (err: any) { setErr("judge", err.message); }
    finally { setLoad("judge", false); }
  }, [user.token]);

  return (
    <TabroomContext.Provider value={{
      user, tournaments, selectedTournament, pairings, coinFlip,
      ballots, myRounds, myRecord, judgeInfo, entries,
      pastResults, upcomingTournaments, loading, errors,
      selectTournament, refreshPairings, refreshBallots,
      refreshMyRounds, refreshEntries, refreshPastResults,
      refreshUpcoming, lookupJudge, htmlPreviews,
    }}>
      {children}
    </TabroomContext.Provider>
  );
}
