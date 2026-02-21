import { useTabroom } from "@/contexts/TabroomContext";

export function NavigationTab() {
  const { pairings, selectedTournament } = useTabroom();

  // Extract unique rooms from pairings
  const rooms = pairings
    .filter((p) => p.room)
    .map((p, i) => ({
      label: `Pairing ${i + 1}`,
      room: p.room,
    }));

  const tournamentName = selectedTournament?.name || "No Tournament";

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Navigation
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        {tournamentName}
      </p>

      {rooms.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">
          No room assignments found. Select a tournament and check pairings first.
        </div>
      ) : (
        <>
          <div className="flow-label mb-2">Rooms from Pairings</div>
          {rooms.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card mb-2"
            >
              <div>
                <div className="flow-label">{r.label}</div>
                <div className="text-[13px] font-medium">{r.room}</div>
              </div>
              <a
                href={`https://maps.google.com?q=${encodeURIComponent(r.room)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md text-[11px] font-medium no-underline"
              >
                ↗ Maps
              </a>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
