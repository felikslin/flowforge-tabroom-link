import { useState, useRef, useEffect } from "react";
import { useTabroom } from "@/contexts/TabroomContext";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function ResultsTab() {
  const {
    tournaments, entries, selectedTournament, selectTournament,
    ballots, myRounds, myRecord, loading, errors,
    refreshBallots, refreshMyRounds, refreshEntries, htmlPreviews,
    pastResults, refreshPastResults,
  } = useTabroom();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAllTournaments, setShowAllTournaments] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [pastResultsFetched, setPastResultsFetched] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);


  // Merge and deduplicate tournament list
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

  // Filter out empty-name tournaments
  const validTournaments = sortedTournaments.filter((t) => t.name && t.name.trim().length > 0);
  const displayedTournaments = showAllTournaments ? validTournaments : validTournaments.slice(0, 20);

  // Use ballots for the selected tournament
  const tournamentBallots = ballots.filter(
    (r) => (r as any).tournament_name === selectedTournament?.name || !selectedTournament
  );

  const speaksValues = tournamentBallots
    .map((r) => parseFloat(r.points))
    .filter((v) => !isNaN(v));
  const avgSpeaks = speaksValues.length > 0
    ? (speaksValues.reduce((a, b) => a + b, 0) / speaksValues.length).toFixed(1)
    : null;

  const handleSelectTournament = (t: typeof allTournaments[0]) => {
    selectTournament(t);
    setDropdownOpen(false);
  };

  // Determine rounds to display (prefer ballots, fallback to myRounds)
  const displayRounds = tournamentBallots.length > 0 ? tournamentBallots : myRounds;

  // Find matching past result for selected tournament
  const matchingPastResult = selectedTournament
    ? pastResults.find((pr) => {
        const prName = pr.tournament?.toLowerCase().trim() || "";
        const selName = selectedTournament.name?.toLowerCase().trim() || "";
        return prName === selName || prName.includes(selName) || selName.includes(prName);
      })
    : null;

  // Fetch past results when no round data is available
  useEffect(() => {
    if (selectedTournament && !loading.ballots && !loading.rounds && displayRounds.length === 0 && !pastResultsFetched) {
      refreshPastResults();
      setPastResultsFetched(true);
    }
  }, [selectedTournament, loading.ballots, loading.rounds, displayRounds.length, pastResultsFetched]);

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Results
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        Round-by-round breakdown · Speaker points · Record
      </p>

      {/* Tournament dropdown */}
      <div className="relative mb-5" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between bg-card border border-border rounded-lg px-3.5 py-2.5 text-left cursor-pointer hover:border-primary/30 transition-colors"
        >
          <div className="flex-1 min-w-0">
            {selectedTournament ? (
              <>
                <div className="text-[13px] font-medium truncate">{selectedTournament.name}</div>
                <div className="flex gap-3 mt-0.5 text-[11px] text-muted-foreground">
                  {selectedTournament.event && <span>{selectedTournament.event}</span>}
                  {selectedTournament.dates && <span>{selectedTournament.dates}</span>}
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Select a tournament…</div>
            )}
          </div>
          <svg className={`w-3 h-3 ml-2 text-muted-foreground transition-transform flex-shrink-0 ${dropdownOpen ? "rotate-180" : ""}`} viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {dropdownOpen && validTournaments.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-[320px] overflow-y-auto py-1">
            {displayedTournaments.map((t, idx) => (
              <button
                key={`${t.id}-${t.name}-${idx}`}
                onClick={() => handleSelectTournament(t)}
                className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors ${
                  selectedTournament?.id === t.id
                    ? "bg-flow-accent-light text-primary font-medium"
                    : "text-foreground hover:bg-flow-surface2"
                }`}
              >
                <div className="font-medium">{t.name}</div>
                <div className="flex gap-3 mt-0.5 text-[11px] text-muted-foreground">
                  {t.event && <span>{t.event}</span>}
                  {t.dates && <span>{t.dates}</span>}
                </div>
              </button>
            ))}
            {!showAllTournaments && validTournaments.length > 20 && (
              <button
                onClick={() => setShowAllTournaments(true)}
                className="w-full text-center py-2 text-xs text-primary hover:bg-flow-surface2 transition-colors"
              >
                Show all {validTournaments.length} tournaments
              </button>
            )}
          </div>
        )}
      </div>

      {(loading.tournaments || loading.entries) && sortedTournaments.length === 0 && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Loading tournaments…
        </div>
      )}

      {!selectedTournament && validTournaments.length > 0 && (
        <div className="text-center py-6 text-muted-foreground text-xs">
          Select a tournament above to view your results.
        </div>
      )}

      {selectedTournament && (
        <>
          {(loading.ballots || loading.rounds) && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs py-6 justify-center">
              <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Loading your results…
            </div>
          )}

          {(errors.ballots || errors.rounds) && (
            <div className="rounded-lg px-3 py-2.5 text-xs mb-3.5"
              style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
              {errors.ballots || errors.rounds}
            </div>
          )}

          {!loading.ballots && !loading.rounds && (
            <>
              {/* Refresh */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { refreshBallots(); refreshMyRounds(); }}
                  className="px-3 py-1.5 rounded-md font-mono text-[11px] cursor-pointer bg-primary text-primary-foreground border-none hover:brightness-90 transition-all"
                >
                  ↻ Refresh Results
                </button>
              </div>

              {/* Stats summary */}
              {displayRounds.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                  <div className="bg-flow-surface2 rounded-lg p-3 text-center">
                    <div className="font-serif text-xl text-primary">
                      {myRecord.wins}–{myRecord.losses}
                    </div>
                    <div className="flow-label mt-1">Record</div>
                  </div>
                  <div className="bg-flow-surface2 rounded-lg p-3 text-center">
                    <div className="font-serif text-xl text-primary">
                      {displayRounds.length}
                    </div>
                    <div className="flow-label mt-1">Rounds</div>
                  </div>
                  {avgSpeaks && (
                    <div className="bg-flow-surface2 rounded-lg p-3 text-center">
                      <div className="font-serif text-xl text-primary">{avgSpeaks}</div>
                      <div className="flow-label mt-1">Avg Speaks</div>
                    </div>
                  )}
                  {speaksValues.length > 0 && (
                    <div className="bg-flow-surface2 rounded-lg p-3 text-center">
                      <div className="font-serif text-xl text-primary">{Math.max(...speaksValues).toFixed(1)}</div>
                      <div className="flow-label mt-1">High Speaks</div>
                    </div>
                  )}
                </div>
              )}

              {/* Speaker Points Trend Chart */}
              {speaksValues.length >= 2 && (
                <div className="bg-flow-surface2 rounded-lg p-3 mb-5">
                  <div className="flow-label mb-2">Speaker Points Trend</div>
                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={tournamentBallots
                        .map((r, i) => ({ name: r.round || `R${i + 1}`, speaks: parseFloat(r.points) }))
                        .filter((d) => !isNaN(d.speaks))}
                        margin={{ top: 5, right: 10, left: -15, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Line type="monotone" dataKey="speaks" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--primary))" }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Round-by-Round Breakdown */}
              {displayRounds.length > 0 && (
                <div className="mb-4">
                  <div className="flow-label mb-2">Round-by-Round Breakdown</div>

                  {/* Table header */}
                  <div className="hidden sm:grid grid-cols-[auto_60px_1fr_1fr_60px_60px] gap-x-2 px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium border-b border-border mb-1">
                    <span>Round</span>
                    <span>Side</span>
                    <span>Opponent</span>
                    <span>Judge</span>
                    <span>Result</span>
                    <span>Speaks</span>
                  </div>

                  {displayRounds.map((r, i) => {
                    const isWin = /w|win/i.test(r.decision);
                    const isLoss = /l|loss/i.test(r.decision);
                    return (
                      <div key={i} className="flow-card relative overflow-hidden mb-2">
                        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                          isWin ? "bg-primary" : isLoss ? "bg-destructive" : "bg-muted-foreground/30"
                        }`} />
                        
                        {/* Desktop layout */}
                        <div className="hidden sm:grid grid-cols-[auto_60px_1fr_1fr_60px_60px] gap-x-2 items-center pl-3">
                          <span className="text-sm font-medium min-w-[60px]">{r.round}</span>
                          <span className="text-xs text-muted-foreground">{r.side || "—"}</span>
                          <span className="text-xs font-medium truncate">{r.opponent || "—"}</span>
                          <span className="text-xs text-muted-foreground truncate">{r.judge || "—"}</span>
                          <span>
                            {(isWin || isLoss) && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isWin ? "bg-flow-accent-light text-primary" : "bg-flow-warn-light text-destructive"}`}>
                                {isWin ? "W" : "L"}
                              </span>
                            )}
                          </span>
                          <span className="text-xs font-medium">{r.points || "—"}</span>
                        </div>

                        {/* Mobile layout */}
                        <div className="sm:hidden pl-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium">{r.round}</span>
                            {(isWin || isLoss) && (
                              <span className={`flow-badge ${isWin ? "bg-flow-accent-light text-primary" : "bg-flow-warn-light text-destructive"}`}>
                                {isWin ? "✓ Win" : "✗ Loss"}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-4 flex-wrap text-xs">
                            {r.side && (
                              <div className="flex flex-col gap-px">
                                <span className="flow-label">Side</span>
                                <span className="font-medium">{r.side}</span>
                              </div>
                            )}
                            {r.opponent && (
                              <div className="flex flex-col gap-px">
                                <span className="flow-label">Opponent</span>
                                <span className="font-medium">{r.opponent}</span>
                              </div>
                            )}
                            {r.judge && (
                              <div className="flex flex-col gap-px">
                                <span className="flow-label">Judge</span>
                                <span className="font-medium">{r.judge}</span>
                              </div>
                            )}
                            {r.points && (
                              <div className="flex flex-col gap-px">
                                <span className="flow-label">Speaks</span>
                                <span className="font-medium">{r.points}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {displayRounds.length === 0 && (
                <div className="space-y-4">
                  {matchingPastResult ? (
                    <div className="bg-flow-surface2 rounded-lg p-4">
                      <div className="flow-label mb-3">Tournament Summary</div>
                      <div className="grid grid-cols-2 gap-3">
                        {matchingPastResult.event && (
                          <div>
                            <div className="flow-label">Event</div>
                            <div className="text-sm font-medium">{matchingPastResult.event}</div>
                          </div>
                        )}
                        {matchingPastResult.place && (
                          <div>
                            <div className="flow-label">Placement</div>
                            <div className="text-sm font-medium text-primary">{matchingPastResult.place}</div>
                          </div>
                        )}
                        {matchingPastResult.record && (
                          <div>
                            <div className="flow-label">Record</div>
                            <div className="text-sm font-medium">{matchingPastResult.record}</div>
                          </div>
                        )}
                      </div>
                      <p className="text-muted-foreground text-[10px] mt-3">
                        Detailed round-by-round data is not available for this tournament.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-xs">
                      No results found for this tournament. Results may not be posted yet, or this tournament may not have public data.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
