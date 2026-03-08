import { useState, useMemo } from "react";
import { useTabroom } from "@/contexts/TabroomContext";
import type { TabroomPairingsEvent, TabroomPairingsRound } from "@/lib/tabroom-api";

/* ── Column type detection ──────────────────────────────── */
const isRoomCol      = (h: string) => /^(room|chamber)$/i.test(h);
const isJudgeCol     = (h: string) => /judg/i.test(h);
/** Congress: presiding officer / parliamentarian → renders like judge */
const isPresidingCol = (h: string) => /presid|parliamentar/i.test(h);
/** Congress: bill / legislation / docket / resolution → neutral label chip */
const isMeasureCol   = (h: string) => /legislat|bill|resolut|docket|measure/i.test(h);
const isAffCol    = (h: string) => /^aff/i.test(h);
const isNegCol    = (h: string) => /^neg/i.test(h);
const isEntryCol  = (h: string) => /^entry_\d+$/i.test(h);
const entryColIndex = (h: string) => parseInt(h.replace(/^entry_/i, ''), 10);

/**
 * Split judge cell value into individual names.
 * Keeps "Lastname, Firstname" format intact — does NOT flip.
 *
 * Handles (in order of priority):
 *  1. Newline-separated  →  split on \n
 *  2. Semicolon-separated → split on ;
 *  3. " & "-separated     → split on " & "
 *  4. Exactly 2 comma parts → single "Lastname, Firstname" → kept as-is
 *  5. Even ≥ 4 comma parts → grouped in pairs as "Lastname, Firstname"
 *  6. Anything else → return parts as-is
 */
const splitJudgeNames = (v: string): string[] => {
  if (!v) return [];
  if (v.includes("\n")) return v.split("\n").map(s => s.trim()).filter(Boolean);
  if (v.includes(";"))  return v.split(";").map(s => s.trim()).filter(Boolean);
  if (v.includes(" & ")) return v.split(" & ").map(s => s.trim()).filter(Boolean);

  const parts = v.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length === 2) return [v.trim()]; // single "Last, First" — keep as-is
  if (parts.length >= 4 && parts.length % 2 === 0) {
    const names: string[] = [];
    for (let i = 0; i < parts.length; i += 2) names.push(`${parts[i]}, ${parts[i + 1]}`);
    return names;
  }
  return parts.length > 0 ? parts : [v.trim()];
};

/**
 * Split a team/entry cell into individual name tokens.
 *
 * Priority:
 *  1. Newline / semicolon / " & " / comma separators — split on those
 *  2. Otherwise treat successive word-pairs as "Firstname Lastname"
 *     (handles hyphenated last names like "Duran-Oropeza" since those
 *      are a single whitespace-token)
 */
const splitTeamNames = (v: string): string[] => {
  if (!v) return [];
  if (v.includes("\n")) return v.split("\n").map(s => s.trim()).filter(Boolean);
  if (v.includes(";"))  return v.split(";").map(s => s.trim()).filter(Boolean);
  if (v.includes(" & ")) return v.split(" & ").map(s => s.trim()).filter(Boolean);
  const commaParts = v.split(",").map(s => s.trim()).filter(Boolean);
  if (commaParts.length > 1) return commaParts;

  // No delimiter found — split word-tokens into pairs ("First Last")
  const words = v.trim().split(/\s+/);
  if (words.length >= 4 && words.length % 2 === 0) {
    const names: string[] = [];
    for (let i = 0; i < words.length; i += 2) names.push(`${words[i]} ${words[i + 1]}`);
    return names;
  }
  // Odd count or ≤ 3 words — just return the whole string
  return [v.trim()];
};

const JUDGE_MAX_VISIBLE = 5;
const ENTRY_MAX_VISIBLE = 8;

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
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

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
    if (!headers.length) return "24px 1fr";
    const cols = headers.map(h => {
      if (isRoomCol(h))      return "minmax(56px, auto)";
      if (isJudgeCol(h) || isPresidingCol(h)) return "minmax(0, 1.6fr)";
      if (isMeasureCol(h))   return "minmax(0, 2fr)";
      return "minmax(0, 1fr)";
    });
    return ["24px", ...cols].join(" ");
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
        {selectedPairingsEvent && selectedPairingsRound && (
          <div className="flex items-center gap-2 mt-3">
            <span
              className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-[6px] text-[10px] font-semibold text-white flex-shrink-0"
              style={{
                background: eventColor(
                  pairingsEvents.findIndex((e: TabroomPairingsEvent) => e.id === selectedPairingsEvent.id)
                ),
                fontFamily: "'Fraunces', serif",
              }}
            >
              {selectedPairingsEvent.name.charAt(0).toUpperCase()}
            </span>
            <span className="text-[12px] font-medium text-foreground/75 font-mono tracking-[-0.1px]">
              {selectedPairingsEvent.name}
            </span>
            <svg className="w-[10px] h-[10px] text-muted-foreground/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[12px] font-medium text-primary/80 font-mono tracking-[-0.1px]">
              {selectedPairingsRound.name}
            </span>
          </div>
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
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <svg className="absolute left-[9px] top-1/2 -translate-y-1/2 w-[13px] h-[13px] text-muted-foreground/35 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search pairings…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pr-search"
                  />
                </div>
                {/* Count pill */}
                <span className="flex-shrink-0 font-mono text-[10.5px] text-muted-foreground/55 tabular-nums px-2.5 py-1.5 rounded-[7px] bg-muted border border-border whitespace-nowrap">
                  {filteredPairings.length === pairings.length
                    ? `${pairings.length} match${pairings.length !== 1 ? "es" : ""}`
                    : `${filteredPairings.length} / ${pairings.length}`}
                </span>
                <button onClick={refreshPairings} disabled={loading.pairings} className="pr-icon-btn flex-shrink-0" title="Refresh">
                  <svg className="w-[13px] h-[13px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {filteredPairings.length === 0 ? (
                <div className="pr-empty py-10">
                  <p className="text-[11.5px] text-muted-foreground/50 font-mono">No results for &ldquo;{search}&rdquo;</p>
                </div>
              ) : (
                <div className="pr-table">
                  {/* Column header band */}
                  <div className="pr-table-head" style={{ gridTemplateColumns: gridTemplate }}>
                    <span /> {/* spacer aligned with row-number column */}
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
                        animationDelay: `${Math.min(i * 18, 220)}ms`,
                      } as React.CSSProperties}
                    >
                      {/* Row number badge */}
                      <span className="pr-row-num">{i + 1}</span>

                      {/* Data cells */}
                      {headers.map((header, j) => {
                        const raw = String(row[header] ?? "");

                        /* ── Room ── */
                        if (isRoomCol(header)) {
                          return (
                            <div key={j} className="pr-cell justify-center">
                              <span className="pr-room-pill">{raw || "—"}</span>
                            </div>
                          );
                        }

                        /* ── Judge / Presiding — collapsible, "Lastname, Firstname" kept as-is ── */
                        if (isJudgeCol(header) || isPresidingCol(header)) {
                          const names      = splitJudgeNames(raw);
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
                                <button className="pr-chip--more" onClick={e => {
                                  e.stopPropagation();
                                  setExpandedJudges(prev => new Set([...prev, i]));
                                }}>+{overflow} more</button>
                              )}
                              {isExpanded && overflow > 0 && (
                                <button className="pr-chip--more" onClick={e => {
                                  e.stopPropagation();
                                  setExpandedJudges(prev => { const s = new Set(prev); s.delete(i); return s; });
                                }}>show less</button>
                              )}
                            </div>
                          );
                        }

                        /* ── Legislation / Docket — neutral label block ── */
                        if (isMeasureCol(header)) {
                          return (
                            <div key={j} className="pr-cell">
                              {raw
                                ? <span className="pr-chip pr-chip--measure">{raw}</span>
                                : <span className="pr-empty-cell">—</span>}
                            </div>
                          );
                        }

                        /* ── Team / Aff / Neg / generic (incl. Congress entries) ── */
                        const allNames = splitTeamNames(raw);
                        const entryKey = `${i}-${j}`;
                        const isEntryExpanded = expandedEntries.has(entryKey);
                        const entryOverflow  = allNames.length - ENTRY_MAX_VISIBLE;
                        const visibleNames   = isEntryExpanded ? allNames : allNames.slice(0, ENTRY_MAX_VISIBLE);
                        // Alternate green / amber by column position for visual variety
                        const chipCls = isAffCol(header)
                          ? "pr-chip--aff"
                          : isNegCol(header)
                            ? "pr-chip--neg"
                            : isEntryCol(header)
                              ? entryColIndex(header) % 2 === 1 ? "pr-chip--aff" : "pr-chip--neg"
                              : j % 2 === 0 ? "pr-chip--aff" : "pr-chip--neg";
                        return (
                          <div key={j} className="pr-cell">
                            {visibleNames.length > 0 ? visibleNames.map((name, k) => (
                              <span key={k} className={`pr-chip ${chipCls}`}>{name}</span>
                            )) : (
                              <span className="pr-empty-cell">—</span>
                            )}
                            {!isEntryExpanded && entryOverflow > 0 && (
                              <button className="pr-chip--more" onClick={e => {
                                e.stopPropagation();
                                setExpandedEntries(prev => new Set([...prev, entryKey]));
                              }}>+{entryOverflow} more</button>
                            )}
                            {isEntryExpanded && entryOverflow > 0 && (
                              <button className="pr-chip--more" onClick={e => {
                                e.stopPropagation();
                                setExpandedEntries(prev => { const s = new Set(prev); s.delete(entryKey); return s; });
                              }}>show less</button>
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
