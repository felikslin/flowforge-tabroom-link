import { useState, useRef, useEffect } from "react";
import { useTabroom } from "@/contexts/TabroomContext";

interface RightPanelProps {
  onSignOut: () => void;
}

export function FlowRightPanel({ onSignOut }: RightPanelProps) {
  const { user, selectedTournament, tournaments, entries, selectTournament, pairings, myRecord, myRounds, pastResults, loading } = useTabroom();
  const initial = user.name[0]?.toUpperCase() || "?";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Merge and deduplicate, sort most recent first
  const allTournaments = [...tournaments];
  for (const e of entries) {
    if (!allTournaments.find((t) => t.id === e.id)) allTournaments.push(e);
  }
  const sortedTournaments = [...allTournaments].sort((a, b) => {
    if (!a.dates && !b.dates) return 0;
    if (!a.dates) return 1;
    if (!b.dates) return -1;
    return b.dates.localeCompare(a.dates);
  });

  // Calc avg speaks from rounds
  const speaksValues = myRounds.map((r) => parseFloat(r.points)).filter((v) => !isNaN(v));
  const avgSpeaks = speaksValues.length > 0
    ? (speaksValues.reduce((a, b) => a + b, 0) / speaksValues.length).toFixed(1)
    : null;

  // Count only user's pairings
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const userNorm = normalize(user.name || "");
  const userParts = (user.name || "").trim().split(/\s+/);
  const lastNorm = normalize(userParts[userParts.length - 1] || "");
  const myPairingsCount = pairings.filter((p) => {
    const affNorm = normalize(p.aff);
    const negNorm = normalize(p.neg);
    if (affNorm.includes(userNorm) || negNorm.includes(userNorm)) return true;
    if (lastNorm.length >= 3 && (affNorm.includes(lastNorm) || negNorm.includes(lastNorm))) return true;
    return false;
  }).length;

  // Aggregate record from past results as fallback
  const pastRecord = pastResults.reduce(
    (acc, r) => {
      const match = r.record?.match(/(\d+)-(\d+)/);
      if (match) { acc.wins += parseInt(match[1]); acc.losses += parseInt(match[2]); }
      return acc;
    },
    { wins: 0, losses: 0 }
  );

  const hasRoundRecord = myRounds.length > 0;
  const hasPastRecord = pastRecord.wins + pastRecord.losses > 0;

  // Determine what to show
  const recordDisplay = hasRoundRecord
    ? `${myRecord.wins}–${myRecord.losses}`
    : hasPastRecord
      ? `${pastRecord.wins}–${pastRecord.losses}`
      : "—";
  const recordLabel = hasRoundRecord ? "Record" : hasPastRecord ? "Career" : "Record";

  const secondStat = avgSpeaks || (myPairingsCount > 0 ? myPairingsCount : "—");
  const secondLabel = avgSpeaks ? "Avg Speaks" : myPairingsCount > 0 ? "My Pairings" : "Speaks";

  return (
    <aside className="w-[240px] flex-shrink-0 bg-card border-l border-border p-4 flex flex-col gap-5 overflow-y-auto">
      {/* Tournament selector */}
      <div>
        <div className="flow-label mb-2.5">Tournament</div>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full text-left bg-flow-accent-light rounded-lg p-2.5 text-xs cursor-pointer border border-primary/20 hover:border-primary/40 transition-colors"
          >
            {selectedTournament ? (
              <>
                <div className="font-medium text-primary truncate">{selectedTournament.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-muted-foreground">
                    {selectedTournament.dates || `ID: ${selectedTournament.id}`}
                  </span>
                  <svg className={`w-2.5 h-2.5 text-muted-foreground transition-transform ${dropdownOpen ? "rotate-180" : ""}`} viewBox="0 0 10 6" fill="none">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground flex items-center justify-between">
                <span>Select tournament…</span>
                <svg className={`w-2.5 h-2.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} viewBox="0 0 10 6" fill="none">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </button>

          {dropdownOpen && sortedTournaments.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-[200px] overflow-y-auto py-1">
              {sortedTournaments.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { selectTournament(t); setDropdownOpen(false); }}
                  className={`w-full text-left px-2.5 py-2 text-[11px] transition-colors ${
                    selectedTournament?.id === t.id
                      ? "bg-flow-accent-light text-primary font-medium"
                      : "text-foreground hover:bg-flow-surface2"
                  }`}
                >
                  <div className="font-medium truncate">{t.name}</div>
                  {t.dates && <div className="text-[10px] text-muted-foreground mt-0.5">{t.dates}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div>
        <div className="flow-label mb-2.5">Stats</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-flow-surface2 rounded-lg p-2.5 text-center">
            <div className="font-serif text-2xl font-normal text-primary">
              {recordDisplay}
            </div>
            <div className="flow-label mt-1">{recordLabel}</div>
          </div>
          <div className="bg-flow-surface2 rounded-lg p-2.5 text-center">
            <div className="font-serif text-2xl font-normal text-primary">
              {secondStat}
            </div>
            <div className="flow-label mt-1">{secondLabel}</div>
          </div>
        </div>
        {(loading.pairings || loading.rounds) && (
          <div className="text-[11px] text-muted-foreground text-center mt-2">Loading…</div>
        )}
      </div>

      {/* Account */}
      <div>
        <div className="flow-label mb-2.5">Account</div>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{initial}</div>
          <div>
            <div className="text-xs font-medium">{user.name}</div>
            <div className="text-[10.5px] text-muted-foreground">{user.email}</div>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-[11.5px] mb-3">
          <span className="text-primary">✓ Live Tabroom data</span>
          <span className="text-primary">✓ AI assistant</span>
          <span className="text-primary">✓ Judge paradigms</span>
        </div>
        <button onClick={onSignOut}
          className="w-full py-1.5 rounded-lg bg-flow-warn-light text-destructive text-[11px] font-medium cursor-pointer border-none font-mono transition-colors hover:bg-destructive/20">
          Sign out
        </button>
      </div>
    </aside>
  );
}
