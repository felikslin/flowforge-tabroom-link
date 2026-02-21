import { useEffect } from "react";
import { useTabroom } from "@/contexts/TabroomContext";

export function HistoryTab() {
  const { pastResults, upcomingTournaments, loading, errors, refreshPastResults, refreshUpcoming } = useTabroom();

  useEffect(() => {
    refreshPastResults();
    refreshUpcoming();
  }, [refreshPastResults, refreshUpcoming]);

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        History & Upcoming
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        Past results and available tournaments
      </p>

      {/* Past Results */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flow-label">Past Results</div>
          <button onClick={refreshPastResults}
            className="px-2.5 py-1 rounded-md font-mono text-[10px] cursor-pointer bg-flow-surface2 text-foreground border border-border hover:border-primary/20 transition-colors">
            ↻
          </button>
        </div>

        {loading.pastResults && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs py-6 justify-center">
            <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            Loading results…
          </div>
        )}

        {errors.pastResults && (
          <div className="rounded-lg px-3 py-2.5 text-xs mb-3"
            style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
            {errors.pastResults}
          </div>
        )}

        {!loading.pastResults && pastResults.length > 0 && (
          <div className="space-y-2">
            {pastResults.map((r, i) => (
              <div key={i} className="flow-card py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium">{r.tournament}</div>
                    <div className="flex gap-3 mt-0.5 text-[11px] text-muted-foreground">
                      {r.event && <span>{r.event}</span>}
                      {r.record && <span>Record: {r.record}</span>}
                    </div>
                  </div>
                  {r.place && (
                    <div className="bg-flow-gold-light text-[hsl(var(--flow-gold))] px-2.5 py-1 rounded-full text-[11px] font-medium">
                      {r.place}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading.pastResults && pastResults.length === 0 && !errors.pastResults && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            No past results found. They may not be publicly available.
          </div>
        )}
      </div>

      {/* Upcoming Tournaments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flow-label">Upcoming Tournaments</div>
          <button onClick={refreshUpcoming}
            className="px-2.5 py-1 rounded-md font-mono text-[10px] cursor-pointer bg-flow-surface2 text-foreground border border-border hover:border-primary/20 transition-colors">
            ↻
          </button>
        </div>

        {loading.upcoming && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs py-6 justify-center">
            <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            Loading upcoming…
          </div>
        )}

        {errors.upcoming && (
          <div className="rounded-lg px-3 py-2.5 text-xs mb-3"
            style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
            {errors.upcoming}
          </div>
        )}

        {!loading.upcoming && upcomingTournaments.length > 0 && (
          <div className="space-y-2">
            {upcomingTournaments.slice(0, 20).map((t, i) => (
              <div key={i} className="flow-card py-3">
                <div className="text-[13px] font-medium">{t.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  ID: {t.id}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading.upcoming && upcomingTournaments.length === 0 && !errors.upcoming && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            No upcoming tournaments found.
          </div>
        )}
      </div>
    </div>
  );
}
