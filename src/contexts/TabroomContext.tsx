import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { FlowUser } from "@/types/flow";
import {
  tabroomGetMyTournaments,
  tabroomGetPairings,
  tabroomGetBallots,
  tabroomGetJudge,
  type TabroomTournament,
  type TabroomPairing,
  type TabroomJudgeInfo,
  type TabroomCoinFlip,
} from "@/lib/tabroom-api";

interface TabroomState {
  user: FlowUser;
  tournaments: TabroomTournament[];
  selectedTournament: TabroomTournament | null;
  pairings: TabroomPairing[];
  coinFlip: TabroomCoinFlip | null;
  ballots: { html_preview?: string } | null;
  judgeInfo: TabroomJudgeInfo | null;
  loading: {
    tournaments: boolean;
    pairings: boolean;
    ballots: boolean;
    judge: boolean;
  };
  errors: {
    tournaments: string | null;
    pairings: string | null;
    ballots: string | null;
    judge: string | null;
  };
  selectTournament: (t: TabroomTournament) => void;
  refreshPairings: () => void;
  refreshBallots: () => void;
  lookupJudge: (name?: string, id?: string) => void;
  htmlPreviews: {
    tournaments?: string;
    pairings?: string;
    ballots?: string;
  };
}

const TabroomContext = createContext<TabroomState | null>(null);

export function useTabroom() {
  const ctx = useContext(TabroomContext);
  if (!ctx) throw new Error("useTabroom must be inside TabroomProvider");
  return ctx;
}

export function TabroomProvider({ user, children }: { user: FlowUser; children: ReactNode }) {
  const [tournaments, setTournaments] = useState<TabroomTournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<TabroomTournament | null>(null);
  const [pairings, setPairings] = useState<TabroomPairing[]>([]);
  const [coinFlip, setCoinFlip] = useState<TabroomCoinFlip | null>(null);
  const [ballots, setBallots] = useState<{ html_preview?: string } | null>(null);
  const [judgeInfo, setJudgeInfo] = useState<TabroomJudgeInfo | null>(null);
  const [htmlPreviews, setHtmlPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState({
    tournaments: false,
    pairings: false,
    ballots: false,
    judge: false,
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({
    tournaments: null,
    pairings: null,
    ballots: null,
    judge: null,
  });

  // Fetch tournaments on mount
  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading((l) => ({ ...l, tournaments: true }));
      setErrors((e) => ({ ...e, tournaments: null }));
      try {
        const res = await tabroomGetMyTournaments(user.token);
        if (!cancelled) {
          setTournaments(res.tournaments || []);
          setHtmlPreviews((h) => ({ ...h, tournaments: (res as any).html_preview }));
          // Auto-select first tournament
          if (res.tournaments?.length > 0 && !selectedTournament) {
            setSelectedTournament(res.tournaments[0]);
          }
        }
      } catch (err: any) {
        if (!cancelled) setErrors((e) => ({ ...e, tournaments: err.message }));
      } finally {
        if (!cancelled) setLoading((l) => ({ ...l, tournaments: false }));
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [user.token]);

  const selectTournament = useCallback((t: TabroomTournament) => {
    setSelectedTournament(t);
  }, []);

  // Fetch pairings when tournament changes
  const refreshPairings = useCallback(async () => {
    if (!selectedTournament) return;
    setLoading((l) => ({ ...l, pairings: true }));
    setErrors((e) => ({ ...e, pairings: null }));
    try {
      const res = await tabroomGetPairings(user.token, selectedTournament.id);
      setPairings(res.pairings || []);
      setCoinFlip(res.coin_flip || null);
      setHtmlPreviews((h) => ({ ...h, pairings: (res as any).html_preview }));
    } catch (err: any) {
      setErrors((e) => ({ ...e, pairings: err.message }));
    } finally {
      setLoading((l) => ({ ...l, pairings: false }));
    }
  }, [user.token, selectedTournament]);

  useEffect(() => {
    if (selectedTournament) refreshPairings();
  }, [selectedTournament, refreshPairings]);

  // Fetch ballots when tournament changes
  const refreshBallots = useCallback(async () => {
    if (!selectedTournament) return;
    setLoading((l) => ({ ...l, ballots: true }));
    setErrors((e) => ({ ...e, ballots: null }));
    try {
      const res = await tabroomGetBallots(user.token, selectedTournament.id);
      setBallots(res);
      setHtmlPreviews((h) => ({ ...h, ballots: (res as any).html_preview }));
    } catch (err: any) {
      setErrors((e) => ({ ...e, ballots: err.message }));
    } finally {
      setLoading((l) => ({ ...l, ballots: false }));
    }
  }, [user.token, selectedTournament]);

  useEffect(() => {
    if (selectedTournament) refreshBallots();
  }, [selectedTournament, refreshBallots]);

  const lookupJudge = useCallback(async (name?: string, id?: string) => {
    setLoading((l) => ({ ...l, judge: true }));
    setErrors((e) => ({ ...e, judge: null }));
    try {
      const res = await tabroomGetJudge(id, name);
      setJudgeInfo(res);
    } catch (err: any) {
      setErrors((e) => ({ ...e, judge: err.message }));
    } finally {
      setLoading((l) => ({ ...l, judge: false }));
    }
  }, []);

  return (
    <TabroomContext.Provider
      value={{
        user,
        tournaments,
        selectedTournament,
        pairings,
        coinFlip,
        ballots,
        judgeInfo,
        loading,
        errors: errors as any,
        selectTournament,
        refreshPairings,
        refreshBallots,
        lookupJudge,
        htmlPreviews,
      }}
    >
      {children}
    </TabroomContext.Provider>
  );
}
