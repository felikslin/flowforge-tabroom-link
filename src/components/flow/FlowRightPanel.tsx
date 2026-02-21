import { useTabroom } from "@/contexts/TabroomContext";

interface RightPanelProps {
  onSignOut: () => void;
}

export function FlowRightPanel({ onSignOut }: RightPanelProps) {
  const { user, selectedTournament, tournaments, pairings, myRecord, myRounds, loading } = useTabroom();
  const initial = user.name[0]?.toUpperCase() || "?";

  // Calc avg speaks from rounds
  const speaksValues = myRounds.map((r) => parseFloat(r.points)).filter((v) => !isNaN(v));
  const avgSpeaks = speaksValues.length > 0
    ? (speaksValues.reduce((a, b) => a + b, 0) / speaksValues.length).toFixed(1)
    : null;

  return (
    <aside className="w-[240px] flex-shrink-0 bg-card border-l border-border p-4 flex flex-col gap-5 overflow-y-auto">
      {/* Tournament info */}
      <div>
        <div className="flow-label mb-2.5">Tournament</div>
        {selectedTournament ? (
          <div className="bg-flow-accent-light rounded-lg p-2.5 text-xs">
            <div className="font-medium text-primary">{selectedTournament.name}</div>
            <div className="text-muted-foreground mt-1">ID: {selectedTournament.id}</div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No tournament selected</div>
        )}
      </div>

      {/* Quick stats */}
      <div>
        <div className="flow-label mb-2.5">Stats</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-flow-surface2 rounded-lg p-2.5 text-center">
            <div className="font-serif text-2xl font-normal text-primary">
              {myRounds.length > 0 ? `${myRecord.wins}–${myRecord.losses}` : tournaments.length}
            </div>
            <div className="flow-label mt-1">{myRounds.length > 0 ? "Record" : "Tournaments"}</div>
          </div>
          <div className="bg-flow-surface2 rounded-lg p-2.5 text-center">
            <div className="font-serif text-2xl font-normal text-primary">
              {avgSpeaks || pairings.length}
            </div>
            <div className="flow-label mt-1">{avgSpeaks ? "Avg Speaks" : "Pairings"}</div>
          </div>
        </div>
        {(loading.pairings || loading.rounds) && (
          <div className="text-[11px] text-muted-foreground text-center mt-2">Loading…</div>
        )}
      </div>

      {/* Account */}
      <div>
        <div className="flow-label mb-2.5">Account</div>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{initial}</div>
          <div>
            <div className="text-xs font-medium">{user.name}</div>
            <div className="text-[10.5px] text-muted-foreground">{user.email}</div>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-[11.5px] mb-3">
          <span className="text-primary">✓ Live Tabroom data</span>
          <span className="text-primary">✓ AI assistant</span>
          <span className="text-primary">✓ Judge paradigms</span>
        </div>
        <button onClick={onSignOut}
          className="w-full py-1.5 rounded-lg bg-flow-warn-light text-destructive text-[11px] font-medium cursor-pointer border-none font-mono transition-colors hover:bg-destructive/20">
          Sign out
        </button>
      </div>
    </aside>
  );
}
