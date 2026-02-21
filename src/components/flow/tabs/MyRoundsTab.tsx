import { useState } from "react";
import { MOCK_ROUNDS } from "@/data/mock-data";
import type { TabId } from "@/types/flow";

interface MyRoundsTabProps {
  onTabChange: (tab: TabId) => void;
}

export function MyRoundsTab({ onTabChange }: MyRoundsTabProps) {
  const [showFlip, setShowFlip] = useState(true);

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        My Rounds
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        Harvard Invitational · Lincoln-Douglas · Nov 14–16
      </p>

      {/* Flip banner */}
      {showFlip && (
        <div className="bg-flow-warn-light border border-destructive/30 rounded-lg px-3.5 py-3 mb-3 flex items-center gap-3">
          <div className="text-[22px] flex-shrink-0">🪙</div>
          <div>
            <div className="text-[13px] font-medium text-destructive mb-0.5">
              Coin flip — Round 3
            </div>
            <div className="text-[11px] text-muted-foreground">
              Head to Sever 107. You won flip in R1 and R2.
            </div>
          </div>
          <button
            onClick={() => setShowFlip(false)}
            className="ml-auto bg-destructive text-destructive-foreground border-none px-3 py-1.5 rounded-md font-mono text-[11px] font-medium cursor-pointer flex-shrink-0 hover:brightness-90"
          >
            Done ✓
          </button>
        </div>
      )}

      {/* Rounds */}
      {MOCK_ROUNDS.map((round, i) => (
        <div
          key={i}
          className="flow-card relative overflow-hidden mb-2.5"
        >
          {/* Left accent bar */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-[3px] ${
              round.status === "current"
                ? "bg-destructive"
                : round.status === "upcoming"
                ? "bg-flow-gold"
                : "bg-primary"
            }`}
          />

          <div className="pl-2">
            <div className="font-serif text-[11px] text-muted-foreground italic mb-0.5">
              {round.round} · {round.status === "current" ? "Now" : round.status === "complete" ? "Complete" : "Upcoming"}
            </div>
            <div className="text-sm font-medium mb-2.5 tracking-[-0.2px]">
              {round.status === "upcoming"
                ? round.opponent
                : `vs. ${round.opponent}${round.school ? ` — ${round.school}` : ""}`}
            </div>

            <div className="flex gap-4 flex-wrap">
              {round.result && (
                <div className="flex flex-col gap-px">
                  <span className="flow-label">Result</span>
                  <span className="text-xs font-medium text-primary">{round.result}</span>
                </div>
              )}
              {round.room && (
                <div className="flex flex-col gap-px">
                  <span className="flow-label">Room</span>
                  <span className="text-xs font-medium">{round.room}</span>
                </div>
              )}
              {round.side && (
                <div className="flex flex-col gap-px">
                  <span className="flow-label">Side</span>
                  <span className="text-xs font-medium">{round.side}</span>
                </div>
              )}
              {round.judge && (
                <div className="flex flex-col gap-px">
                  <span className="flow-label">Judge</span>
                  <span className="text-xs font-medium">{round.judge}</span>
                </div>
              )}
              {round.start && (
                <div className="flex flex-col gap-px">
                  <span className="flow-label">{round.status === "upcoming" ? "Est. Start" : "Start"}</span>
                  <span className="text-xs font-medium">{round.start}</span>
                </div>
              )}
              {round.points && (
                <div className="flex flex-col gap-px">
                  <span className="flow-label">Pts</span>
                  <span className="text-xs font-medium text-primary">{round.points}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            {round.status !== "upcoming" && (
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                {round.status === "current" && (
                  <>
                    <button
                      onClick={() => onTabChange("judge")}
                      className="inline-flex items-center gap-1.5 bg-flow-accent-light text-primary px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer border-none font-mono transition-colors hover:bg-primary/20"
                    >
                      ⚖️ Paradigm
                    </button>
                    <button
                      onClick={() => onTabChange("nav")}
                      className="inline-flex items-center gap-1.5 bg-flow-accent-light text-primary px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer border-none font-mono transition-colors hover:bg-primary/20"
                    >
                      📍 Campus Map
                    </button>
                  </>
                )}
                {round.status === "complete" && (
                  <button
                    onClick={() => onTabChange("ballots")}
                    className="inline-flex items-center gap-1.5 bg-flow-accent-light text-primary px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer border-none font-mono transition-colors hover:bg-primary/20"
                  >
                    📊 View Ballot
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
