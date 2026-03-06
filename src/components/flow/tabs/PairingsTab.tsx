import { useState, useMemo } from "react";
import { useTabroom } from "@/contexts/TabroomContext";
import type { TabroomPairingsEvent, TabroomPairingsRound } from "@/lib/tabroom-api";

/* ── Column type detection ──────────────────────────────── */
const isRoomCol   = (h: string) => /^(room|chamber)$/i.test(h);
const isJudgeCol  = (h: string) => /judg/i.test(h);
const isAffCol    = (h: string) => /^aff/i.test(h);
const isEntryCol  = (h: string) => /^entry_\d+$/i.test(h);
const entryColIndex = (h: string) => parseInt(h.replace(/^entry_/i, ''), 10);

/**
 * Split a raw cell value into individual name tokens.
 *
 * Priority:
 *  1. "Last, First" single-person — exactly two comma parts, each ≤ 2 words
 *     → flip to "First Last" and return as one name
 *  2. Multiple comma parts → list of separate people
 *  3. " & " → list of separate people
 *  4. Judge blob (all caps / Title Case, no separator) → regex-extract names
 *  5. Everything else → return as-is
 */
const splitNames = (v: string, isJudge = false): string[] => {
  if (!v) return [];

  const commaParts = v.split(",").map(s => s.trim()).filter(Boolean);

  if (commaParts.length === 2) {
    const [a, b] = commaParts;
    const aWords = a.split(/\s+/).filter(Boolean).length;
    const bWords = b.split(/\s+/).filter(Boolean).length;
    // Heuristic: "Surname, Firstname" — first part is a short surname,
    // second part is a given name (≤ 2 words total on each side)
    if (aWords <= 2 && bWords <= 2) {
      return [`${b} ${a}`]; // flip to "First Last"
    }
  }

  if (commaParts.length > 1) return commaParts;
  if (v.includes(" & ")) return v.split(" & ").map(s => s.trim()).filter(Boolean);

  if (isJudge) {
    // Extract consecutive Title-Cased word groups (handles hyphenated names)
    const matches = v.match(/[A-Z][a-zA-Z'\-]+(?:\s[A-Z][a-zA-Z'\-]+)*/g);
    if (matches && matches.length > 1) return matches;
  }

  return [v];
};

const JUDGE_MAX_VISIBLE = 5;

/* Deterministic per-event colours */
const EVENT_PALETTE = [
  "#007AFF", "#34C759", "#FF9500", "#AF52DE",
  "#5856D6", "#FF2D55", "#00C7BE", "#FF3B30",
  "#30B0C7", "#32ADE6",
];
const eventColor = (i: number) => EVENT_PALETTE[i % EVENT_PALETTE.length];

export function PairingsTab() {
  const {
    pairings, pairingsHeaders, pairingsEvents,
    selectedPairingsEvent, selectedPairingsRound,
    loading, errors, selectedTournament,
    refreshPairings, selectPairingsEvent, selectPairingsRound,
    htmlPreviews,
  } = useTabroom();

  const [search, setSearch] = useState("");
  /** Set of row indices whose judge cell is expanded to show all names */
  const [expandedJudges, setExpandedJudges] = useState<Set<number>>(new Set());

  // Derive column order from scraped headers; fall back to first-row keys if the
  // server omitted headers (shouldn't happen, but guards against empty responses).
  const headers = useMemo(() => {
    if (pairingsHeaders?.length) return pairingsHeaders;
    if (pairings.length > 0) return Object.keys(pairings[0]);
    return [];
  }, [pairingsHeaders, pairings]);

  const formatHeader = (h: string) => {
    if (isEntryCol(h)) return `Team ${entryColIndex(h)}`;
    return h.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  /**
   * Grid column widths:
   *  - Row-number column always prepended: 28px
   *  - Room: "auto" → shrinks to the widest room value in the column
   *  - Judge: minmax(0, 2fr) → gets double the space of team cols
   *  - Everything else: minmax(0, 1fr)
   */
  const gridTemplate = useMemo(() => {
    if (!headers.length) return "28px 1fr";
    const cols = headers.map(h => {
      if (isRoomCol(h))  return "auto";
      if (isJudgeCol(h)) return "minmax(0, 2fr)";
      return "minmax(0, 1fr)";
    });
    return ["28px", ...cols].join(" ");
  }, [headers]);

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
          className="text-[21px] font-semibold tracking-[-0.3px] text-foreground leading-none"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Pairings
        </h2>
        {selectedTournament && (
          <p className="text-muted-foreground/55 text-[11px] mt-1.5 font-mono tracking-[0.1px]">
            {selectedTournament.name}
          </p>
        )}
      </div>

      {/* ── Empty state: no tournament ───────────── */}
      {!selectedTournament && (
        <div className="pr-empty">
          <div className="pr-empty-icon">
            <svg className="w-[18px] h-[18px] text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-[12.5px] font-medium text-foreground/60 font-mono tracking-[-0.1px]">No tournament selected</p>
          <p className="text-[11px] text-muted-foreground/50 mt-1 font-mono">Choose a tournament in Entries.</p>
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
                <div className="pr-events-card">
                  {pairingsEvents.map((ev: TabroomPairingsEvent, i: number) => (
                    <div key={ev.id}>
                      {i > 0 && <div className="pr-event-divider" />}
                      <button
                        onClick={() => selectPairingsEvent(ev)}
                        className="pr-event-row"
                      >
                        {/* Coloured icon square */}
                        <span
                          className="pr-event-icon"
                          style={{ background: eventColor(i) }}
                          aria-hidden
                        >
                          {ev.name.charAt(0).toUpperCase()}
                        </span>

                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] font-medium text-foreground/90 truncate block font-mono tracking-[-0.1px]">
                            {ev.name}
                          </span>
                          <span className="text-[10.5px] text-muted-foreground/50 mt-[2px] block font-mono">
                            {ev.rounds.length} round{ev.rounds.length !== 1 && "s"}
                          </span>
                        </div>

                        {/* Round count badge + chevron */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="pr-event-badge">{ev.rounds.length}</span>
                          <svg
                            className="w-[13px] h-[13px] text-muted-foreground/30"
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    </div>
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
              {/* Back + event header */}
              <button
                onClick={() => { selectPairingsEvent(null); selectPairingsRound(null); setSearch(""); }}
                className="pr-back"
              >
                <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Events
              </button>

              {/* Event title row */}
              <div className="flex items-center gap-2.5 mt-4 mb-4">
                <span
                  className="pr-event-icon"
                  style={{
                    background: eventColor(
                      pairingsEvents.findIndex((e: TabroomPairingsEvent) => e.id === selectedPairingsEvent.id)
                    ),
                    width: 32, height: 32, minWidth: 32,
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  aria-hidden
                >
                  {selectedPairingsEvent.name.charAt(0).toUpperCase()}
                </span>
                <h3
                  className="text-[15px] font-semibold text-foreground leading-none"
                  style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-0.2px" }}
                >
                  {selectedPairingsEvent.name}
                </h3>
              </div>

              {/* Round pills */}
              {selectedPairingsEvent.rounds.length > 0 ? (
                <div className="pr-rounds">
                  {selectedPairingsEvent.rounds.map((r: TabroomPairingsRound) => (
                    <button
                      key={r.id}
                      onClick={() => { selectPairingsRound(r); setSearch(""); }}
                      className={`pr-round-pill ${selectedPairingsRound?.id === r.id ? "active" : ""}`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground/50 font-mono">No rounds available.</p>
              )}
            </section>
          )}

          {/* ── Error / loading ─────────────────────── */}
          {errors.pairings && <div className="pr-error mb-4">{errors.pairings}</div>}

          {loading.pairings && (
            <div className="pr-spinner py-16"><div className="pr-spinner-ring" /><span>Loading pairings</span></div>
          )}

          {/* ── PAIRINGS TABLE ──────────────────────── */}
          {!loading.pairings && pairings.length > 0 && (
            <div className="pr-animate-in">
              {/* Toolbar */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <svg className="absolute left-[9px] top-1/2 -translate-y-1/2 w-[13px] h-[13px] text-muted-foreground/35 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search pairings"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pr-search"
                  />
                </div>
                <button onClick={refreshPairings} disabled={loading.pairings} className="pr-icon-btn" title="Refresh">
                  <svg className="w-[13px] h-[13px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              <p className="text-[10.5px] text-muted-foreground/50 mb-3 tabular-nums font-mono tracking-[0.1px]">
                {filteredPairings.length === pairings.length
                  ? `${pairings.length} pairing${pairings.length !== 1 ? "s" : ""}`
                  : `${filteredPairings.length} of ${pairings.length}`}
              </p>

              {filteredPairings.length === 0 ? (
                <div className="pr-empty py-10">
                  <p className="text-[11.5px] text-muted-foreground/50 font-mono">No results for &ldquo;{search}&rdquo;</p>
                </div>
              ) : (
                <div className="pr-table">
                  {/* Header row */}
                  <div className="pr-table-head" style={{ gridTemplateColumns: gridTemplate }}>
                    <span /> {/* spacer for row-number column */}
                    {headers.map(h => (
                      <span key={h} className="pr-col-label">{formatHeader(h)}</span>
                    ))}
                  </div>

                  {/* Data rows */}
                  {filteredPairings.map((row, i) => (
                    <div
                      key={i}
                      className={`pr-table-row${i < filteredPairings.length - 1 ? " pr-table-row--sep" : ""}`}
                      style={{
                        gridTemplateColumns: gridTemplate,
                        animationDelay: `${Math.min(i * 16, 200)}ms`,
                      } as React.CSSProperties}
                    >
                      {/* Row number */}
                      <span className="pr-row-num">{i + 1}</span>

                      {/* Data cells */}
                      {headers.map((header, j) => {
                        const raw = String(row[header] ?? "");

                        /* ── Room ── */
                        if (isRoomCol(header)) {
                          return (
                            <div key={j} className="pr-cell">
                              <span className="pr-room-pill">{raw || "—"}</span>
                            </div>
                          );
                        }

                        /* ── Judge — collapsible overflow ── */
                        if (isJudgeCol(header)) {
                          const names      = splitNames(raw, true);
                          const isExpanded = expandedJudges.has(i);
                          const visible    = isExpanded ? names : names.slice(0, JUDGE_MAX_VISIBLE);
                          const overflow   = names.length - JUDGE_MAX_VISIBLE;
                          return (
                            <div key={j} className="pr-cell">
                              {visible.length > 0 ? visible.map((name, k) => (
                                <span key={k} className="pr-chip pr-chip--judge">{name}</span>
                              )) : (
                                <span className="pr-empty-cell">—</span>
                              )}
                              {!isExpanded && overflow > 0 && (
                                <button className="pr-chip pr-chip--more" onClick={e => {
                                  e.stopPropagation();
                                  setExpandedJudges(prev => new Set([...prev, i]));
                                }}>+{overflow} more</button>
                              )}
                              {isExpanded && overflow > 0 && (
                                <button className="pr-chip pr-chip--more" onClick={e => {
                                  e.stopPropagation();
                                  setExpandedJudges(prev => { const s = new Set(prev); s.delete(i); return s; });
                                }}>less</button>
                              )}
                            </div>
                          );
                        }

                        /* ── Team / Aff / Neg / generic ── */
                        const names = splitNames(raw, false);
                        const chipCls = isAffCol(header)
                          ? "pr-chip--aff"
                          : isEntryCol(header)
                            ? entryColIndex(header) % 2 === 1 ? "pr-chip--aff" : "pr-chip--neg"
                            : "pr-chip--neg";
                        return (
                          <div key={j} className="pr-cell">
                            {names.length > 0 ? names.map((name, k) => (
                              <span key={k} className={`pr-chip ${chipCls}`}>{name}</span>
                            )) : (
                              <span className="pr-empty-cell">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Empty states ────────────────────────── */}
          {!loading.pairings && !pairings.length && selectedPairingsRound && (
            <div className="pr-empty">
              <div className="pr-empty-icon">
                <svg className="w-[18px] h-[18px] text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-[12.5px] font-medium text-foreground/55 font-mono tracking-[-0.1px]">No pairings yet</p>
              <p className="text-[11px] text-muted-foreground/45 mt-1 font-mono">
                {htmlPreviews.pairings
                  ? "Couldn't parse pairings. See raw HTML below."
                  : "Not posted for this round yet."}
              </p>
            </div>
          )}

          {!loading.pairings && !pairings.length && !selectedPairingsRound && selectedPairingsEvent && (
            <div className="pr-empty">
              <p className="text-[11px] text-muted-foreground/45 font-mono">Select a round above.</p>
            </div>
          )}

          {!pairings.length && htmlPreviews.pairings && (
            <details className="mt-4">
              <summary className="text-[10.5px] text-muted-foreground/40 cursor-pointer hover:text-primary/60 transition-colors select-none font-mono tracking-[0.2px]">
                Raw HTML
              </summary>
              <div
                className="mt-2 bg-muted/40 rounded-[10px] p-4 text-[11px] leading-[1.7] max-h-[280px] overflow-y-auto border border-border"
                dangerouslySetInnerHTML={{ __html: htmlPreviews.pairings }}
              />
            </details>
          )}
        </>
      )}

      <p className="text-[9.5px] text-muted-foreground/35 mt-7 font-mono tracking-[0.3px]">
        Data from Tabroom.com
      </p>
    </div>
  );
}
