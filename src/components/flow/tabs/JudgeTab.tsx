import { useState } from "react";
import { useTabroom } from "@/contexts/TabroomContext";

export function JudgeTab() {
  const { judgeInfo, loading, errors, lookupJudge } = useTabroom();
  const [searchName, setSearchName] = useState("");

  const handleSearch = () => {
    const name = searchName.trim();
    if (name) {
      console.log("[JudgeTab] Searching for judge:", name);
      lookupJudge(name);
    }
  };

  // Log judge info when it changes for debugging
  if (judgeInfo) {
    console.log("[JudgeTab] judgeInfo received:", {
      name: judgeInfo.name,
      hasParadigm: !!judgeInfo.paradigm,
      paradigmLength: judgeInfo.paradigm?.length || 0,
      resultsCount: judgeInfo.results?.length || 0,
      source: (judgeInfo as any).source,
      warning: (judgeInfo as any).warning,
    });
  }

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Judge Info
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        Look up any judge's paradigm
      </p>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Judge name (e.g. Michael Okafor)"
          className="flex-1 border border-border rounded-lg px-3 py-2.5 font-mono text-xs bg-background text-foreground outline-none transition-colors focus:border-primary"
        />
        <button
          onClick={handleSearch}
          disabled={loading.judge || !searchName.trim()}
          className="bg-primary text-primary-foreground border-none rounded-lg px-4 py-2.5 text-[11px] font-medium cursor-pointer disabled:opacity-50 hover:brightness-90 transition-all"
        >
          {loading.judge ? "Searching..." : "Look Up"}
        </button>
      </div>

      {errors.judge && (
        <div className="rounded-lg px-3 py-2.5 text-xs mb-3.5"
          style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
          {errors.judge}
        </div>
      )}

      {loading.judge && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Searching Tabroom for judge...
        </div>
      )}

      {judgeInfo && !loading.judge && (
        <div className="flow-card">
          {/* Warning message (e.g. login required) */}
          {(judgeInfo as any).warning && (
            <div className="rounded-lg px-3 py-2 text-xs mb-3"
              style={{ background: "rgba(196,160,42,.15)", border: "1px solid rgba(196,160,42,.3)", color: "#ec8" }}>
              {(judgeInfo as any).warning}
            </div>
          )}

          <div className="flex items-center justify-between mb-1">
            <div className="text-[15px] font-medium">{judgeInfo.name || searchName || "Unknown Judge"}</div>
            {judgeInfo.tabroom_url && (
              <a
                href={judgeInfo.tabroom_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-primary underline hover:brightness-90 transition-all"
              >
                View on Tabroom
              </a>
            )}
          </div>

          {/* Data source indicator */}
          {(judgeInfo as any).source && (
            <p className="text-[10px] text-muted-foreground mb-2">
              Source: {(judgeInfo as any).source === "tournaments_tech" ? "tournaments.tech" : "Tabroom"}
            </p>
          )}

          {/* Multiple results */}
          {judgeInfo.results && judgeInfo.results.length > 0 && !judgeInfo.paradigm && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-2">Multiple judges found - select one:</p>
              <div className="flex flex-col gap-1.5">
                {judgeInfo.results.map((r) => (
                  <button
                    key={r.judge_id}
                    onClick={() => {
                      console.log("[JudgeTab] Selected judge:", r.name, "id:", r.judge_id);
                      lookupJudge(undefined, r.judge_id);
                    }}
                    className="text-left px-3 py-2 rounded-lg bg-flow-surface2 text-xs hover:bg-primary/10 transition-colors cursor-pointer border border-border"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Paradigm */}
          {judgeInfo.paradigm ? (
            <div className="bg-flow-surface2 rounded-lg p-3.5 text-xs leading-[1.9] max-h-[300px] overflow-y-auto italic border-l-[3px] border-border mt-3 whitespace-pre-wrap">
              {judgeInfo.paradigm}
            </div>
          ) : !judgeInfo.results?.length && (
            <div className="text-xs text-muted-foreground mt-2">
              No paradigm text found for this judge.
            </div>
          )}

          {/* Raw HTML preview if available */}
          {judgeInfo.html_preview && (
            <details className="mt-3">
              <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                Show raw paradigm page
              </summary>
              <div
                className="mt-2 bg-flow-surface2 rounded-lg p-3 text-[11px] leading-[1.6] max-h-[250px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: judgeInfo.html_preview }}
              />
            </details>
          )}
        </div>
      )}

      {!judgeInfo && !loading.judge && !errors.judge && (
        <div className="text-center py-8 text-muted-foreground text-xs">
          Enter a judge name to look up their paradigm from Tabroom.
        </div>
      )}
    </div>
  );
}
