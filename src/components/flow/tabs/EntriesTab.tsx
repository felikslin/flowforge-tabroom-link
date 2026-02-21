import { useTabroom } from "@/contexts/TabroomContext";

export function EntriesTab() {
  const { tournaments, selectedTournament, selectTournament, loading, errors } = useTabroom();

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        My Entries
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        Loaded from your Tabroom account
      </p>

      {loading.tournaments && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Loading tournaments…
        </div>
      )}

      {errors.tournaments && (
        <div className="rounded-lg px-3 py-2.5 text-xs mb-3.5"
          style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
          {errors.tournaments}
        </div>
      )}

      {!loading.tournaments && tournaments.length === 0 && !errors.tournaments && (
        <div className="text-center py-8 text-muted-foreground text-xs">
          No tournament entries found on your Tabroom account.
        </div>
      )}

      {tournaments.length > 0 && (
        <>
          <div className="flow-label mb-2">Your Tournaments</div>
          {tournaments.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTournament(t)}
              className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg border mb-2 transition-colors ${
                selectedTournament?.id === t.id
                  ? "bg-flow-accent-light border-primary/20"
                  : "bg-card border-border hover:border-primary/20"
              }`}
            >
              <div>
                <div className="text-[13px] font-medium">{t.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  ID: {t.id}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-[10px] font-medium mt-1 ${
                  selectedTournament?.id === t.id ? "text-primary" : "text-muted-foreground"
                }`}>
                  {selectedTournament?.id === t.id ? "Selected" : "Tap to select"}
                </div>
              </div>
            </button>
          ))}
        </>
      )}

      <div className="mt-3.5 px-3 py-3 bg-flow-accent-light rounded-lg text-[11.5px] text-primary leading-[1.7]">
        ✦ These load automatically from Tabroom. Select a tournament to view its pairings, ballots, and more.
      </div>
    </div>
  );
}
