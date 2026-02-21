import { useTabroom } from "@/contexts/TabroomContext";
import type { TabId } from "@/types/flow";

interface MyRoundsTabProps {
  onTabChange: (tab: TabId) => void;
}

export function MyRoundsTab({ onTabChange }: MyRoundsTabProps) {
  const { myRounds, myRecord, pairings, selectedTournament, loading, errors, refreshMyRounds } = useTabroom();

  const hasRoundData = myRounds.length > 0;

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        My Rounds
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        {selectedTournament?.name || "No tournament selected"}
        {hasRoundData && ` · ${myRecord.wins}–${myRecord.losses}`}
      </p>

      {!selectedTournament && (
        <div className="text-center py-8 text-muted-foreground text-xs">
          Select a tournament from the{" "}
          <button onClick={() => onTabChange("entries")} className="text-primary underline bg-transparent border-none cursor-pointer text-xs">
            Entries tab
          </button>{" "}first.
        </div>
      )}

      {(loading.rounds || loading.pairings) && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Loading rounds…
        </div>
      )}

      {errors.rounds && (
        <div className="rounded-lg px-3 py-2.5 text-xs mb-3.5"
          style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
          {errors.rounds}
        </div>
      )}

      {selectedTournament && !loading.rounds && (
        <>
          {/* Record badge */}
          {hasRoundData && (
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-flow-accent-light text-primary px-3 py-1.5 rounded-full text-xs font-medium">
                Record: {myRecord.wins}–{myRecord.losses}
              </div>
              <button
                onClick={refreshMyRounds}
                className="px-3 py-1.5 rounded-md font-mono text-[11px] cursor-pointer bg-primary text-primary-foreground border-none hover:brightness-90 transition-all"
              >
                ↻ Refresh
              </button>
            </div>
          )}

          {/* Live round data */}
          {hasRoundData && myRounds.map((r, i) => {
            const isWin = /w|win/i.test(r.decision);
            const isLoss = /l|loss/i.test(r.decision);
            const hasResult = isWin || isLoss;

            return (
              <div key={i} className="flow-card relative overflow-hidden mb-2.5">
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                  isWin ? "bg-primary" : isLoss ? "bg-destructive" : "bg-muted-foreground/30"
                }`} />
                <div className="pl-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium tracking-[-0.2px]">{r.round}</span>
                    {hasResult && (
                      <span className={`flow-badge ${isWin ? "bg-flow-accent-light text-primary" : "bg-flow-warn-light text-destructive"}`}>
                        {isWin ? "✓ Win" : "✗ Loss"}
                      </span>
                    )}
                    {!hasResult && r.opponent && (
                      <span className="flow-badge bg-flow-gold-light text-[hsl(var(--flow-gold))]">Current</span>
                    )}
                  </div>

                  {r.opponent && (
                    <div className="text-xs text-foreground mb-2">
                      vs. <span className="font-medium">{r.opponent}</span>
                    </div>
                  )}

                  <div className="flex gap-4 flex-wrap text-xs">
                    {r.side && (
                      <div className="flex flex-col gap-px">
                        <span className="flow-label">Side</span>
                        <span className="font-medium">{r.side}</span>
                      </div>
                    )}
                    {r.judge && (
                      <div className="flex flex-col gap-px">
                        <span className="flow-label">Judge</span>
                        <span className="font-medium">{r.judge}</span>
                      </div>
                    )}
                    {r.room && (
                      <div className="flex flex-col gap-px">
                        <span className="flow-label">Room</span>
                        <span className="font-medium">{r.room}</span>
                      </div>
                    )}
                    {r.points && (
                      <div className="flex flex-col gap-px">
                        <span className="flow-label">Speaks</span>
                        <span className="font-medium">{r.points}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    {r.judge && (
                      <button onClick={() => onTabChange("judge")}
                        className="inline-flex items-center gap-1.5 bg-flow-accent-light text-primary px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer border-none font-mono transition-colors hover:bg-primary/20">
                        ⚖️ Paradigm
                      </button>
                    )}
                    {r.room && (
                      <button onClick={() => onTabChange("nav")}
                        className="inline-flex items-center gap-1.5 bg-flow-accent-light text-primary px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer border-none font-mono transition-colors hover:bg-primary/20">
                        📍 Directions
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Fallback: show pairings if no round-specific data */}
          {!hasRoundData && pairings.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground mb-3">
                Showing current pairings (detailed round data not yet available):
              </div>
              {pairings.map((p, i) => (
                <div key={i} className="flow-card relative overflow-hidden mb-2.5">
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
                  <div className="pl-2">
                    <div className="text-sm font-medium mb-2 tracking-[-0.2px]">
                      {p.aff} vs. {p.neg}
                    </div>
                    <div className="flex gap-4 flex-wrap">
                      {p.room && (
                        <div className="flex flex-col gap-px">
                          <span className="flow-label">Room</span>
                          <span className="text-xs font-medium">{p.room}</span>
                        </div>
                      )}
                      {p.judge && (
                        <div className="flex flex-col gap-px">
                          <span className="flow-label">Judge</span>
                          <span className="text-xs font-medium">{p.judge}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {!hasRoundData && pairings.length === 0 && !errors.rounds && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No round data found yet. Pairings may not have been posted.
            </div>
          )}
        </>
      )}
    </div>
  );
}
