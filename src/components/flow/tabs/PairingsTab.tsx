import { useState, useMemo } from "react";
import { useTabroom } from "@/contexts/TabroomContext";
import type { TabroomPairingsEvent, TabroomPairingsRound } from "@/lib/tabroom-api";

/* Detect column "type" for styling */
const isRoomCol = (h: string) => /^(room|chamber)$/i.test(h);
const isJudgeCol = (h: string) => /judge/i.test(h);
const isAffCol = (h: string) => /^aff/i.test(h);

/** Split a cell value into individual name tokens */
const splitNames = (v: string) => {
  if (!v) return [];
  return v.includes(",")
    ? v.split(",").map(s => s.trim()).filter(Boolean)
    : v.includes(" & ")
      ? v.split(" & ").map(s => s.trim()).filter(Boolean)
      : [v];
};

export function PairingsTab() {
  const {
    pairings, pairingsHeaders, pairingsEvents,
    selectedPairingsEvent, selectedPairingsRound,
    loading, errors, selectedTournament,
    refreshPairings, selectPairingsEvent, selectPairingsRound,
    htmlPreviews,
  } = useTabroom();

  const [search, setSearch] = useState("");

  const headers = pairingsHeaders?.length ? pairingsHeaders : ["room", "aff", "neg", "judge"];

  const formatHeader = (h: string) =>
    h.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const filteredPairings = useMemo(() => {
    if (!search.trim()) return pairings;
    const q = search.toLowerCase();
    return pairings.filter(row =>
      headers.some(h => String(row[h] ?? "").toLowerCase().includes(q))
    );
  }, [pairings, search, headers]);

  /* ────────────────────────────────────────── */
  return (
    <div className="pr-animate-in">
      {/* Title */}
      <div className="mb-6">
        <h2
          className="text-[22px] font-semibold tracking-[-0.5px] text-foreground"
          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" }}
        >
          Pairings
        </h2>
        {selectedTournament && (
          <p
            className="text-muted-foreground/60 text-[12px] mt-0.5 tracking-[-0.1px]"
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}
          >
            {selectedTournament.name}
          </p>
        )}
      </div>

      {/* ── Empty state: no tournament ───────────── */}
      {!selectedTournament && (
        <div className="pr-empty">
          <div className="pr-empty-icon">
            <svg className="w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p
            className="text-[13px] font-medium text-foreground/60"
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", letterSpacing: "-0.15px" }}
          >No tournament selected</p>
          <p
            className="text-[11.5px] text-muted-foreground/50 mt-1"
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}
          >Choose a tournament in Entries.</p>
        </div>
      )}

      {selectedTournament && (
        <>
          {/* ── Event picker ────────────────────────── */}
          {!selectedPairingsEvent && (
            <section>
              <p className="pr-section-label">Events</p>

              {loading.pairingsEvents && <div className="pr-spinner"><div className="pr-spinner-ring" /><span>Loading</span></div>}

              {errors.pairingsEvents && (
                <div className="pr-error">{errors.pairingsEvents}</div>
              )}

              {!loading.pairingsEvents && pairingsEvents.length > 0 && (
                <div className="flex flex-col gap-[5px]">
                  {pairingsEvents.map((ev: TabroomPairingsEvent) => (
                    <button key={ev.id} onClick={() => selectPairingsEvent(ev)} className="pr-list-row group">
                      <div className="flex-1 min-w-0">
                        <span
                          className="text-[13.5px] font-medium text-foreground/90 truncate block"
                          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", letterSpacing: "-0.2px" }}
                        >
                          {ev.name}
                        </span>
                        <span
                          className="text-[11px] text-muted-foreground/45 mt-[2px] block"
                          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}
                        >
                          {ev.rounds.length} round{ev.rounds.length !== 1 && "s"}
                        </span>
                      </div>
                      <svg className="w-[14px] h-[14px] text-muted-foreground/25 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              )}

              {!loading.pairingsEvents && !pairingsEvents.length && (
                <div className="pr-empty"><p className="text-[12px] text-muted-foreground/50">No events found.</p></div>
              )}
            </section>
          )}

          {/* ── Round picker ────────────────────────── */}
          {selectedPairingsEvent && (
            <section className="mb-5">
              <button
                onClick={() => { selectPairingsEvent(null); selectPairingsRound(null); setSearch(""); }}
                className="pr-back"
              >
                <svg className="w-[13px] h-[13px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Events
              </button>

              <h3
                className="text-[15px] font-semibold text-foreground mt-4 mb-3 tracking-[-0.3px]"
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif" }}
              >
                {selectedPairingsEvent.name}
              </h3>

              {selectedPairingsEvent.rounds.length > 0 ? (
                <div className="pr-seg">
                  {selectedPairingsEvent.rounds.map((r: TabroomPairingsRound) => (
                    <button
                      key={r.id}
                      onClick={() => { selectPairingsRound(r); setSearch(""); }}
                      className={`pr-seg-item ${selectedPairingsRound?.id === r.id ? "active" : ""}`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground/50">No rounds available.</p>
              )}
            </section>
          )}

          {/* ── Error / loading ─────────────────────── */}
          {errors.pairings && <div className="pr-error mb-4">{errors.pairings}</div>}

          {loading.pairings && (
            <div className="pr-spinner py-16"><div className="pr-spinner-ring" /><span>Loading pairings</span></div>
          )}

          {/* ── THE TABLE ───────────────────────────── */}
          {!loading.pairings && pairings.length > 0 && (
            <div className="pr-animate-in">
              {/* Toolbar */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <svg className="absolute left-[10px] top-1/2 -translate-y-1/2 w-[13px] h-[13px] text-muted-foreground/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    type="text"
                    placeholder="Search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pr-search"
                  />
                </div>
                <button onClick={refreshPairings} disabled={loading.pairings} className="pr-icon-btn" title="Refresh">
                  <svg className="w-[13px] h-[13px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>

              {/* Count */}
              <p
                className="text-[11px] text-muted-foreground/40 mb-[10px] tabular-nums"
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}
              >
                {filteredPairings.length === pairings.length
                  ? `${pairings.length} pairing${pairings.length !== 1 ? "s" : ""}`
                  : `${filteredPairings.length} of ${pairings.length}`}
              </p>

              {/* Column labels */}
              <div className="pr-row pr-row--header" style={{ "--pr-cols": headers.length - 1 } as React.CSSProperties}>
                {headers.map(h => (
                  <span key={h} className="pr-col-label">{formatHeader(h)}</span>
                ))}
              </div>

              {/* Data rows */}
              <div className="pr-card">
                {filteredPairings.map((row, i) => (
                  <div
                    key={i}
                    className={`pr-row pr-row--data ${i < filteredPairings.length - 1 ? "pr-row--border" : ""}`}
                    style={{
                      "--pr-cols": headers.length - 1,
                      animationDelay: `${Math.min(i * 25, 250)}ms`,
                    } as React.CSSProperties}
                  >
                    {headers.map((header, j) => {
                      const raw = String(row[header] ?? "");

                      /* Room — compact accent number */
                      if (isRoomCol(header)) {
                        return (
                          <div key={j} className="flex items-center self-center">
                            <span className="pr-room">{raw || "–"}</span>
                          </div>
                        );
                      }

                      /* Name pills */
                      const names = splitNames(raw);
                      const chipType = isJudgeCol(header)
                        ? "pr-chip--judge"
                        : isAffCol(header)
                          ? "pr-chip--aff"
                          : "pr-chip--neg";

                      return (
                        <div key={j} className="flex flex-wrap gap-[5px] items-center min-h-[22px]">
                          {names.length > 0 ? names.map((name, k) => (
                            <span key={k} className={`pr-chip ${chipType}`}>{name}</span>
                          )) : (
                            <span className="text-[11px] text-muted-foreground/25">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {filteredPairings.length === 0 && (
                  <div className="pr-empty py-10">
                    <p
                      className="text-[12px] text-muted-foreground/50"
                      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}
                    >No results for &ldquo;{search}&rdquo;</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Empty states ────────────────────────── */}
          {!loading.pairings && !pairings.length && selectedPairingsRound && (
            <div className="pr-empty">
              <div className="pr-empty-icon">
                <svg className="w-4 h-4 text-muted-foreground/35" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              </div>
              <p
                className="text-[13px] font-medium text-foreground/55"
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", letterSpacing: "-0.15px" }}
              >No pairings yet</p>
              <p
                className="text-[11.5px] text-muted-foreground/40 mt-1"
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}
              >
                {htmlPreviews.pairings
                  ? "Couldn't parse pairings. See raw HTML below."
                  : "Not posted for this round yet."}
              </p>
            </div>
          )}

          {!loading.pairings && !pairings.length && !selectedPairingsRound && selectedPairingsEvent && (
            <div className="pr-empty">
              <p
                className="text-[12px] text-muted-foreground/45"
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}
              >Select a round above.</p>
            </div>
          )}

          {!pairings.length && htmlPreviews.pairings && (
            <details className="mt-4">
              <summary
                className="text-[11px] text-muted-foreground/40 cursor-pointer hover:text-muted-foreground/70 transition-colors select-none"
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}
              >
                Raw HTML
              </summary>
              <div
                className="mt-2 bg-muted/30 rounded-[12px] p-4 text-[11px] leading-[1.7] max-h-[280px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: htmlPreviews.pairings }}
              />
            </details>
          )}
        </>
      )}

      <p
        className="text-[10px] text-muted-foreground/30 mt-7"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}
      >
        Data from Tabroom.com
      </p>
    </div>
  );
}
