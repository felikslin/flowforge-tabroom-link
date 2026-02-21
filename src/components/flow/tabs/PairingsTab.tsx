import { useTabroom } from "@/contexts/TabroomContext";

export function PairingsTab() {
  const { pairings, loading, errors, selectedTournament, refreshPairings, htmlPreviews } = useTabroom();

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        All Pairings
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        {selectedTournament?.name || "No tournament selected"}
      </p>

      {!selectedTournament && (
        <div className="text-center py-8 text-muted-foreground text-xs">
          Select a tournament from the Entries tab first.
        </div>
      )}

      {loading.pairings && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Loading pairings…
        </div>
      )}

      {errors.pairings && (
        <div className="rounded-lg px-3 py-2.5 text-xs mb-3.5"
          style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
          {errors.pairings}
        </div>
      )}

      {!loading.pairings && selectedTournament && (
        <>
          <div className="flex gap-2 mb-3.5">
            <button
              onClick={refreshPairings}
              className="px-3 py-1.5 rounded-md font-mono text-[11px] cursor-pointer bg-primary text-primary-foreground border-none hover:brightness-90 transition-all"
            >
              ↻ Refresh
            </button>
          </div>

          {pairings.length > 0 ? (
            <div className="flow-card p-0 overflow-hidden">
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr>
                    {["Room", "AFF", "NEG", "Judge"].map((h) => (
                      <th key={h} className="text-left px-2.5 py-2 flow-label border-b border-border">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pairings.map((row, i) => (
                    <tr key={i} className="hover:bg-flow-surface2 transition-colors">
                      <td className="px-2.5 py-2.5 border-b border-border">{row.room}</td>
                      <td className="px-2.5 py-2.5 border-b border-border">{row.aff}</td>
                      <td className="px-2.5 py-2.5 border-b border-border">{row.neg}</td>
                      <td className="px-2.5 py-2.5 border-b border-border">
                        <span className="text-primary underline cursor-pointer">{row.judge}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-xs">
              {htmlPreviews.pairings
                ? "Pairings page loaded but no structured pairings were parsed. The raw HTML is available below."
                : "No pairings found for this tournament."}
            </div>
          )}

          {pairings.length === 0 && htmlPreviews.pairings && (
            <details className="mt-3">
              <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                Show raw HTML preview
              </summary>
              <div
                className="mt-2 bg-flow-surface2 rounded-lg p-3 text-[11px] leading-[1.6] max-h-[300px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: htmlPreviews.pairings }}
              />
            </details>
          )}
        </>
      )}

      <div className="text-[11px] text-muted-foreground mt-1.5">
        Data scraped from Tabroom. Tap judge name for paradigm.
      </div>
    </div>
  );
}
