import { useTabroom } from "@/contexts/TabroomContext";
import type { TabId } from "@/types/flow";

interface MyRoundsTabProps {
  onTabChange: (tab: TabId) => void;
}

export function MyRoundsTab({ onTabChange }: MyRoundsTabProps) {
  const { pairings, selectedTournament, loading, errors } = useTabroom();

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        My Rounds
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        {selectedTournament?.name || "No tournament selected"}
      </p>

      {!selectedTournament && (
        <div className="text-center py-8 text-muted-foreground text-xs">
          Select a tournament from the <button onClick={() => onTabChange("entries")} className="text-primary underline bg-transparent border-none cursor-pointer text-xs">Entries tab</button> first.
        </div>
      )}

      {loading.pairings && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Loading rounds…
        </div>
      )}

      {errors.pairings && (
        <div className="rounded-lg px-3 py-2.5 text-xs mb-3.5"
          style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
          {errors.pairings}
        </div>
      )}

      {!loading.pairings && selectedTournament && pairings.length > 0 && (
        <>
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
                <div className="flex gap-1.5 mt-2.5 flex-wrap">
                  {p.judge && (
                    <button
                      onClick={() => onTabChange("judge")}
                      className="inline-flex items-center gap-1.5 bg-flow-accent-light text-primary px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer border-none font-mono transition-colors hover:bg-primary/20"
                    >
                      ⚖️ Paradigm
                    </button>
                  )}
                  <button
                    onClick={() => onTabChange("nav")}
                    className="inline-flex items-center gap-1.5 bg-flow-accent-light text-primary px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer border-none font-mono transition-colors hover:bg-primary/20"
                  >
                    📍 Directions
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {!loading.pairings && selectedTournament && pairings.length === 0 && !errors.pairings && (
        <div className="text-center py-8 text-muted-foreground text-xs">
          No pairings found yet. They may not have been posted.
        </div>
      )}
    </div>
  );
}
