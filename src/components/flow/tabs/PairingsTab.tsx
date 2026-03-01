import { useTabroom } from "@/contexts/TabroomContext";
import type { TabroomPairingsEvent, TabroomPairingsRound } from "@/lib/tabroom-api";

export function PairingsTab() {
  const {
    pairings, pairingsHeaders, pairingsEvents,
    selectedPairingsEvent, selectedPairingsRound,
    loading, errors, selectedTournament,
    refreshPairings, selectPairingsEvent, selectPairingsRound,
    htmlPreviews,
  } = useTabroom();

  const headers = pairingsHeaders && pairingsHeaders.length > 0
    ? pairingsHeaders
    : ["room", "aff", "neg", "judge"];

  const formatHeader = (header: string) =>
    header.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const isLoadingEvents = loading.pairingsEvents;
  const isLoadingPairings = loading.pairings;

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        All Pairings
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-4">
        {selectedTournament?.name || "No tournament selected"}
      </p>

      {!selectedTournament && (
        <div className="text-center py-8 text-muted-foreground text-xs">
          Select a tournament from the Entries tab first.
        </div>
      )}

      {selectedTournament && (
        <>
          {/* ── Schematics ─────────────────────────── */}
          <div className="mb-4">
            <p className="flow-label text-[10px] uppercase tracking-widest mb-2">Schematics</p>

            {isLoadingEvents && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
                <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Loading events…
              </div>
            )}

            {errors.pairingsEvents && (
              <div className="rounded-md px-2.5 py-2 text-xs mb-2"
                style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
                {errors.pairingsEvents}
              </div>
            )}

            {/* Event selector */}
            {!isLoadingEvents && pairingsEvents.length > 0 && (
              <div className="mb-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {pairingsEvents.map((event: TabroomPairingsEvent) => (
                    <button
                      key={event.id}
                      onClick={() => selectPairingsEvent(event)}
                      className={[
                        "px-2.5 py-1 rounded-md font-mono text-[11px] cursor-pointer border transition-all",
                        selectedPairingsEvent?.id === event.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground",
                      ].join(" ")}
                    >
                      {event.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Round selector */}
            {selectedPairingsEvent && selectedPairingsEvent.rounds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedPairingsEvent.rounds.map((round: TabroomPairingsRound) => (
                  <button
                    key={round.id}
                    onClick={() => selectPairingsRound(round)}
                    className={[
                      "px-2.5 py-1 rounded-md font-mono text-[10.5px] cursor-pointer border transition-all",
                      selectedPairingsRound?.id === round.id
                        ? "bg-primary/90 text-primary-foreground border-primary/80"
                        : "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
                    ].join(" ")}
                  >
                    {round.name}
                  </button>
                ))}
              </div>
            )}

            {!isLoadingEvents && pairingsEvents.length === 0 && (
              <p className="text-muted-foreground text-xs">No events found for this tournament.</p>
            )}
          </div>

          {/* ── Controls ───────────────────────────── */}
          <div className="flex gap-2 mb-3.5">
            <button
              onClick={refreshPairings}
              disabled={isLoadingPairings}
              className="px-3 py-1.5 rounded-md font-mono text-[11px] cursor-pointer bg-primary text-primary-foreground border-none hover:brightness-90 transition-all disabled:opacity-50"
            >
              ↻ Refresh
            </button>
          </div>

          {/* ── Errors ─────────────────────────────── */}
          {errors.pairings && (
            <div className="rounded-lg px-3 py-2.5 text-xs mb-3.5"
              style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
              {errors.pairings}
            </div>
          )}

          {/* ── Loading pairings ───────────────────── */}
          {isLoadingPairings && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
              <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Loading pairings…
            </div>
          )}

          {/* ── Pairings table ─────────────────────── */}
          {!isLoadingPairings && pairings.length > 0 && (
            <div className="flow-card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11.5px]">
                  <thead>
                    <tr>
                      {headers.map((h) => (
                        <th key={h} className="text-left px-2.5 py-2 flow-label border-b border-border whitespace-nowrap">
                          {formatHeader(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pairings.map((row, i) => (
                      <tr key={i} className="hover:bg-flow-surface2 transition-colors">
                        {headers.map((header, j) => (
                          <td key={j} className="px-2.5 py-2.5 border-b border-border">
                            {header === "judge" || header.includes("judge") ? (
                              <span className="text-primary underline cursor-pointer">
                                {row[header] || "-"}
                              </span>
                            ) : (
                              <span>{row[header] || "-"}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!isLoadingPairings && pairings.length === 0 && selectedPairingsRound && (
            <div className="text-center py-6 text-muted-foreground text-xs">
              {htmlPreviews.pairings
                ? "Pairings page loaded but no structured pairings were parsed. The raw HTML is available below."
                : "No pairings found for this round."}
            </div>
          )}

          {!isLoadingPairings && pairings.length === 0 && !selectedPairingsRound && (
            <div className="text-center py-6 text-muted-foreground text-xs">
              Select an event and round above to view pairings.
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

      <div className="text-[11px] text-muted-foreground mt-3">
        Data scraped from Tabroom. Tap judge name for paradigm.
      </div>
    </div>
  );
}
