export function NavigationTab() {
  const rooms = [
    { round: "Round 1", room: "Emerson Hall, Room 201", status: "Done" },
    { round: "Round 2", room: "Emerson Hall, Room 105", status: "Done" },
    { round: "Round 3 · Now", room: "Sever Hall, Room 107", status: "Current" },
    { round: "Round 4 · TBD", room: "Building TBD", status: "Upcoming" },
  ];

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Navigation
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        Harvard Invitational · Cambridge MA
      </p>

      <div className="flow-label mb-2">My Rooms This Tournament</div>

      {rooms.map((r, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border mb-2 ${
            r.status === "Current"
              ? "bg-flow-accent-light border-primary/20"
              : "bg-card border-border"
          }`}
        >
          <div>
            <div className="flow-label">{r.round}</div>
            <div className="text-[13px] font-medium">{r.room}</div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                r.status === "Current"
                  ? "bg-destructive text-destructive-foreground"
                  : r.status === "Done"
                  ? "bg-flow-surface2 text-muted-foreground"
                  : "bg-flow-gold-light text-flow-gold"
              }`}
            >
              {r.status}
            </span>
            {r.status !== "Upcoming" && (
              <a
                href={`https://maps.google.com?q=${encodeURIComponent(r.room.split(",")[0])}+Harvard`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md text-[11px] font-medium no-underline"
              >
                ↗ Maps
              </a>
            )}
          </div>
        </div>
      ))}

      {/* Map preview */}
      <div className="flow-label mt-4 mb-2">Sever Hall — Current Round</div>
      <div
        className="rounded-lg border border-border h-[130px] flex items-center justify-center relative mb-3 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #e4eeea, #cfe4d8)" }}
      >
        <div className="text-[34px] animate-float relative z-10">📍</div>
        <div className="absolute bottom-2.5 inset-x-0 text-center text-[11px] font-medium text-primary">
          Sever Hall · Harvard Yard, Cambridge MA
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <a
          href="https://maps.google.com?q=Sever+Hall+Harvard+Cambridge"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-medium no-underline bg-primary text-primary-foreground"
        >
          🗺 Open in Google Maps
        </a>
        <a
          href="https://maps.google.com?q=Harvard+Yard+Cambridge"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-medium no-underline bg-flow-surface2 text-foreground border border-border"
        >
          🏛 Harvard Yard Overview
        </a>
      </div>

      <div className="px-3 py-2.5 bg-flow-surface2 rounded-lg text-[11.5px] leading-[1.8] text-muted-foreground">
        💡 <strong className="text-foreground">Walking directions:</strong> From the Science Center
        entrance, head south through the Yard past the John Harvard statue. Sever Hall is the red
        brick building on your right, directly across from Emerson Hall. About 3 min walk.
      </div>
    </div>
  );
}
