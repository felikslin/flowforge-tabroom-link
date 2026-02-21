import { useTabroom } from "@/contexts/TabroomContext";

export function BallotsTab() {
  const { ballots, loading, errors, selectedTournament, refreshBallots, htmlPreviews } = useTabroom();

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Ballots & Points
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        {selectedTournament?.name || "No tournament selected"} · Speaker points · RFDs
      </p>

      {!selectedTournament && (
        <div className="text-center py-8 text-muted-foreground text-xs">
          Select a tournament from the Entries tab first.
        </div>
      )}

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

      {!loading.ballots && selectedTournament && (
        <>
          <div className="flex gap-2 mb-3.5">
            <button
              onClick={refreshBallots}
              className="px-3 py-1.5 rounded-md font-mono text-[11px] cursor-pointer bg-primary text-primary-foreground border-none hover:brightness-90 transition-all"
            >
              ↻ Refresh
            </button>
          </div>

          {htmlPreviews.ballots ? (
            <div className="flow-card">
              <div className="text-xs text-muted-foreground mb-3">
                Ballot data from Tabroom (rendered from HTML):
              </div>
              <div
                className="bg-flow-surface2 rounded-lg p-3 text-[11.5px] leading-[1.7] max-h-[400px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: htmlPreviews.ballots }}
              />
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-xs">
              No ballot data found for this tournament. Ballots may not have been released yet.
            </div>
          )}
        </>
      )}
    </div>
  );
}
