import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { FlowUser } from "@/types/flow";
import {
  tabroomGetMyTournaments,
  tabroomGetPairings,
  tabroomGetPairingsEvents,
  tabroomGetBallots,
  tabroomGetJudge,
  tabroomGetMyRounds,
  tabroomGetEntries,
  tabroomGetUpcoming,
  type TabroomTournament,
  type TabroomPairing,
  type TabroomJudgeInfo,
  type TabroomCoinFlip,
  type TabroomRound,
  type TabroomPairingsEvent,
  type TabroomPairingsRound,
} from "@/lib/tabroom-api";

interface TabroomState {
  user: FlowUser;
  tournaments: TabroomTournament[];
  selectedTournament: TabroomTournament | null;
  pairings: TabroomPairing[];
  pairingsHeaders: string[];
  pairingsEvents: TabroomPairingsEvent[];
  selectedPairingsEvent: TabroomPairingsEvent | null;
  selectedPairingsRound: TabroomPairingsRound | null;
  coinFlip: TabroomCoinFlip | null;
  ballots: TabroomRound[];
  myRounds: TabroomRound[];
  myRecord: { wins: number; losses: number };
  judgeInfo: TabroomJudgeInfo | null;
  entries: TabroomTournament[];
  upcomingTournaments: TabroomTournament[];
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  selectTournament: (t: TabroomTournament) => void;
  selectPairingsEvent: (event: TabroomPairingsEvent) => void;
  selectPairingsRound: (round: TabroomPairingsRound) => void;
  refreshPairings: () => void;
  refreshBallots: () => void;
  refreshMyRounds: () => void;
  refreshEntries: () => void;
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
  const [pairingsHeaders, setPairingsHeaders] = useState<string[]>([]);
  const [pairingsEvents, setPairingsEvents] = useState<TabroomPairingsEvent[]>([]);
  const [selectedPairingsEvent, setSelectedPairingsEvent] = useState<TabroomPairingsEvent | null>(null);
  const [selectedPairingsRound, setSelectedPairingsRound] = useState<TabroomPairingsRound | null>(null);
  const [coinFlip, setCoinFlip] = useState<TabroomCoinFlip | null>(null);
  const [ballots, setBallots] = useState<(TabroomRound & { tournament_name?: string })[]>([]);
  const [myRounds, setMyRounds] = useState<(TabroomRound & { tournament_name?: string })[]>([]);
  const [myRecord, setMyRecord] = useState({ wins: 0, losses: 0 });
  const [judgeInfo, setJudgeInfo] = useState<TabroomJudgeInfo | null>(null);
  const [entries, setEntries] = useState<TabroomTournament[]>([]);
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

  const selectTournament = useCallback((t: TabroomTournament) => {
    setSelectedTournament(t);
    // Reset event/round selection when tournament changes
    setSelectedPairingsEvent(null);
    setSelectedPairingsRound(null);
    setPairingsEvents([]);
    setPairings([]);
  }, []);

  // Pairings events — load all events + rounds for the selected tournament
  const refreshPairingsEvents = useCallback(async () => {
    if (!selectedTournament) return;
    setLoad("pairingsEvents", true); setErr("pairingsEvents", null);
    try {
      const res = await tabroomGetPairingsEvents(user.token, selectedTournament.id);
      const events = res.events || [];
      setPairingsEvents(events);
      // Auto-select first event and first round
      if (events.length > 0) {
        const firstEvent = events[0];
        setSelectedPairingsEvent(firstEvent);
        if (firstEvent.rounds.length > 0) {
          setSelectedPairingsRound(firstEvent.rounds[0]);
        }
      }
    } catch (err: any) { setErr("pairingsEvents", err.message); }
    finally { setLoad("pairingsEvents", false); }
  }, [user.token, selectedTournament]);

  useEffect(() => { if (selectedTournament) refreshPairingsEvents(); }, [selectedTournament, refreshPairingsEvents]);

  // Pairings — fetch for the selected event + round
  const refreshPairings = useCallback(async () => {
    if (!selectedTournament) return;
    setLoad("pairings", true); setErr("pairings", null);
    try {
      const eventId = selectedPairingsEvent?.id !== "default" ? selectedPairingsEvent?.id : undefined;
      const roundId = selectedPairingsRound?.id;
      const res = await tabroomGetPairings(user.token, selectedTournament.id, eventId, roundId);
      setPairings(res.pairings || []);
      setPairingsHeaders(res.headers || []);
      setCoinFlip(res.coin_flip || null);
    } catch (err: any) { setErr("pairings", err.message); }
    finally { setLoad("pairings", false); }
  }, [user.token, selectedTournament, selectedPairingsEvent, selectedPairingsRound]);

  // Re-fetch pairings whenever the selected round changes
  useEffect(() => {
    if (selectedPairingsRound) refreshPairings();
  }, [selectedPairingsRound, refreshPairings]);

  const selectPairingsEvent = useCallback((event: TabroomPairingsEvent) => {
    setSelectedPairingsEvent(event);
    // Auto-select first round of the selected event
    if (event.rounds.length > 0) {
      setSelectedPairingsRound(event.rounds[0]);
    } else {
      setSelectedPairingsRound(null);
      setPairings([]);
    }
  }, []);

  const selectPairingsRound = useCallback((round: TabroomPairingsRound) => {
    setSelectedPairingsRound(round);
  }, []);

  // My Rounds
  const refreshMyRounds = useCallback(async () => {
    if (!selectedTournament) return;
    setLoad("rounds", true); setErr("rounds", null);
    try {
      const res = await tabroomGetMyRounds(user.token, selectedTournament.id, user.name, user.person_id || undefined);
      setMyRounds(res.rounds || []);
      setMyRecord(res.record || { wins: 0, losses: 0 });
      setHtmlPreviews((h) => ({ ...h, rounds: res.html_preview }));
    } catch (err: any) { setErr("rounds", err.message); }
    finally { setLoad("rounds", false); }
  }, [user.token, selectedTournament, user.name, user.person_id]);

  useEffect(() => { if (selectedTournament) refreshMyRounds(); }, [selectedTournament, refreshMyRounds]);

  // Ballots
  const refreshBallots = useCallback(async () => {
    if (!selectedTournament) return;
    setLoad("ballots", true); setErr("ballots", null);
    try {
      const res = await tabroomGetBallots(user.token, selectedTournament.id, undefined, undefined, user.name, user.person_id || undefined);
      const rounds = (res.rounds || []).map((rd: TabroomRound) => ({
        ...rd,
        tournament_name: selectedTournament.name,
      }));
      setBallots(rounds);
      setHtmlPreviews((h) => ({ ...h, ballots: res.html_preview || undefined }));
    } catch (err: any) { setErr("ballots", err.message); }
    finally { setLoad("ballots", false); }
  }, [user.token, selectedTournament, user.name, user.person_id]);

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
      console.log("[TabroomContext] lookupJudge called:", { name, id });
      const res = await tabroomGetJudge(id, name, user.token);
      console.log("[TabroomContext] lookupJudge response:", {
        name: res?.name,
        hasParadigm: !!res?.paradigm,
        resultsCount: res?.results?.length,
        source: (res as any)?.source,
      });
      setJudgeInfo(res);
    } catch (err: any) {
      console.error("[TabroomContext] lookupJudge error:", err.message);
      setErr("judge", err.message);
    }
    finally { setLoad("judge", false); }
  }, [user.token]);

  return (
    <TabroomContext.Provider value={{
      user, tournaments, selectedTournament,
      pairings, pairingsHeaders, pairingsEvents,
      selectedPairingsEvent, selectedPairingsRound,
      coinFlip, ballots, myRounds, myRecord, judgeInfo, entries,
      upcomingTournaments, loading, errors,
      selectTournament, selectPairingsEvent, selectPairingsRound,
      refreshPairings, refreshBallots,
      refreshMyRounds, refreshEntries,
      refreshUpcoming, lookupJudge, htmlPreviews,
    }}>
      {children}
    </TabroomContext.Provider>
  );
}
