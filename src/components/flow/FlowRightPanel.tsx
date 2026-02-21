import type { FlowUser } from "@/types/flow";
import { MOCK_SCHEDULE, MOCK_NEARBY } from "@/data/mock-data";

interface RightPanelProps {
  user: FlowUser;
  onSignOut: () => void;
}

export function FlowRightPanel({ user, onSignOut }: RightPanelProps) {
  const initial = user.name[0]?.toUpperCase() || "?";

  return (
    <aside className="w-[240px] flex-shrink-0 bg-card border-l border-border p-4 flex flex-col gap-5 overflow-y-auto">
      {/* Schedule */}
      <div>
        <div className="flow-label mb-2.5">Today's Schedule</div>
        <div className="flex flex-col">
          {MOCK_SCHEDULE.map((item, i) => (
            <div key={i} className="flex gap-2.5 pb-3 relative">
              {i < MOCK_SCHEDULE.length - 1 && (
                <div className="absolute left-[10px] top-[22px] bottom-0 w-px bg-border" />
              )}
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] flex-shrink-0 mt-0.5 ${
                  item.status === "done"
                    ? "bg-primary border-2 border-primary text-primary-foreground"
                    : item.status === "now"
                    ? "bg-destructive border-2 border-destructive text-destructive-foreground animate-glow"
                    : "bg-flow-surface2 border-2 border-border"
                }`}
              >
                {item.status === "done" ? "✓" : item.status === "now" ? "▸" : ""}
              </div>
              <div>
                <div className="text-xs font-medium mb-px">{item.label}</div>
                <div className="text-[10.5px] text-muted-foreground">{item.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Record */}
      <div>
        <div className="flow-label mb-2.5">My Record</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-flow-surface2 rounded-lg p-2.5 text-center">
            <div className="font-serif text-2xl font-normal text-primary">2</div>
            <div className="flow-label mt-1">Wins</div>
          </div>
          <div className="bg-flow-surface2 rounded-lg p-2.5 text-center">
            <div className="font-serif text-2xl font-normal text-destructive">0</div>
            <div className="flow-label mt-1">Losses</div>
          </div>
        </div>
        <div className="mt-2 bg-flow-surface2 rounded-lg p-2.5 text-center">
          <div className="flow-label">Avg Speaker Pts</div>
          <div className="font-serif text-[22px] font-normal text-primary mt-0.5">28.8</div>
        </div>
        <div className="text-[11px] text-muted-foreground text-center mt-2">
          On bubble for elims 🔥
        </div>
      </div>

      {/* Account */}
      <div>
        <div className="flow-label mb-2.5">Account</div>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
            {initial}
          </div>
          <div>
            <div className="text-xs font-medium">{user.name}</div>
            <div className="text-[10.5px] text-muted-foreground">{user.email}</div>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-[11.5px] mb-3">
          <span className="text-primary">✓ Ballots & speaker points</span>
          <span className="text-primary">✓ Auto-entry detection</span>
          <span className="text-primary">✓ Private tournaments</span>
        </div>
        <button
          onClick={onSignOut}
          className="w-full py-1.5 rounded-lg bg-flow-warn-light text-destructive text-[11px] font-medium cursor-pointer border-none font-mono transition-colors hover:bg-destructive/20"
        >
          Sign out
        </button>
      </div>

      {/* Quick Nearby */}
      <div>
        <div className="flow-label mb-2.5">Quick Nearby</div>
        {MOCK_NEARBY.slice(0, 3).map((place, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5" style={{ borderBottom: i < 2 ? undefined : "none" }}>
            <div className="w-7 h-7 rounded-lg bg-flow-surface2 flex items-center justify-center text-sm flex-shrink-0">
              {place.icon}
            </div>
            <div>
              <div className="text-xs font-medium">{place.name}</div>
              <div className="text-[10.5px] text-muted-foreground">{place.dist}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
