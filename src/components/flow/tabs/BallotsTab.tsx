import { useTabroom } from "@/contexts/TabroomContext";

export function BallotsTab() {
  const { ballots, loading, errors, refreshBallots, htmlPreviews } = useTabroom();

  // Calculate average speaks
  const speaksValues = ballots
    .map((r) => parseFloat(r.points))
    .filter((v) => !isNaN(v));
  const avgSpeaks = speaksValues.length > 0
    ? (speaksValues.reduce((a, b) => a + b, 0) / speaksValues.length).toFixed(1)
    : null;

  // Group by tournament
  const grouped = ballots.reduce<Record<string, typeof ballots>>((acc, r) => {
    const key = (r as any).tournament_name || "Unknown Tournament";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Ballots & Points
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        All tournaments · Speaker points · RFDs
      </p>

      {loading.ballots && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Loading ballots…
        </div>
      )}

      {errors.ballots && (
        <div className="rounded-lg px-3 py-2.5 text-xs mb-3.5"
          style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
          {errors.ballots}
        </div>
      )}

      {!loading.ballots && (
        <>
          <div className="flex gap-2 mb-4">
            <button onClick={refreshBallots}
              className="px-3 py-1.5 rounded-md font-mono text-[11px] cursor-pointer bg-primary text-primary-foreground border-none hover:brightness-90 transition-all">
              ↻ Refresh
            </button>
          </div>

          {/* Stats summary */}
          {ballots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-flow-surface2 rounded-lg p-3 text-center">
                <div className="font-serif text-xl text-primary">{ballots.length}</div>
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

          {/* Ballot cards grouped by tournament */}
          {ballots.length > 0 ? (
            Object.entries(grouped).map(([tournName, rounds]) => (
              <div key={tournName} className="mb-5">
                <div className="flow-label mb-2">{tournName} ({rounds.length})</div>
                {rounds.map((r, i) => {
                  const isWin = /w|win/i.test(r.decision);
                  const isLoss = /l|loss/i.test(r.decision);

                  return (
                    <div key={i} className="flow-card relative overflow-hidden mb-2.5">
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                        isWin ? "bg-primary" : isLoss ? "bg-destructive" : "bg-muted-foreground/30"
                      }`} />
                      <div className="pl-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{r.round}</span>
                          {(isWin || isLoss) && (
                            <span className={`flow-badge ${isWin ? "bg-flow-accent-light text-primary" : "bg-flow-warn-light text-destructive"}`}>
                              {isWin ? "✓ Win" : "✗ Loss"}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 flex-wrap text-xs">
                          {r.opponent && (
                            <div className="flex flex-col gap-px">
                              <span className="flow-label">Opponent</span>
                              <span className="font-medium">{r.opponent}</span>
                            </div>
                          )}
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
            ))
          ) : (
            <>
              {htmlPreviews.ballots ? (
                <div className="flow-card">
                  <div className="text-xs text-muted-foreground mb-3">Raw ballot data:</div>
                  <div className="bg-flow-surface2 rounded-lg p-3 text-[11.5px] leading-[1.7] max-h-[400px] overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: htmlPreviews.ballots }} />
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  No ballot data found. Ballots may not have been released yet.
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
