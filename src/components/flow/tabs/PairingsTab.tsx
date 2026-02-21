import { useState } from "react";
import { MOCK_PAIRINGS } from "@/data/mock-data";

export function PairingsTab() {
  const [activeRound, setActiveRound] = useState(2);

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        All Pairings
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        Harvard Invitational · LD
      </p>

      <div className="flex gap-1.5 mb-3.5">
        {["Round 1", "Round 2", "Round 3"].map((label, i) => (
          <button
            key={i}
            onClick={() => setActiveRound(i)}
            className={`px-3 py-1.5 rounded-md font-mono text-[11px] cursor-pointer border transition-all ${
              activeRound === i
                ? "bg-card text-foreground font-medium shadow-sm border-border"
                : "bg-flow-surface2 text-muted-foreground border-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flow-card p-0 overflow-hidden">
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr>
              {["Room", "AFF", "NEG", "Judge"].map((h) => (
                <th
                  key={h}
                  className="text-left px-2.5 py-2 flow-label border-b border-border"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_PAIRINGS[activeRound].map((row, i) => (
              <tr
                key={i}
                className={`transition-colors ${
                  row.isMe
                    ? "bg-flow-accent-light font-medium"
                    : "hover:bg-flow-surface2 cursor-pointer"
                }`}
              >
                <td className="px-2.5 py-2.5 border-b border-border last:border-b-0">{row.room}</td>
                <td className="px-2.5 py-2.5 border-b border-border last:border-b-0">{row.aff}</td>
                <td className="px-2.5 py-2.5 border-b border-border last:border-b-0">{row.neg}</td>
                <td className="px-2.5 py-2.5 border-b border-border last:border-b-0">
                  <span className="text-primary underline cursor-pointer">{row.judge}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1.5">
        Your entry highlighted. Tap judge name for paradigm.
      </div>
    </div>
  );
}
