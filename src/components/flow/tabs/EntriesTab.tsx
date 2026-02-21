export function EntriesTab() {
  const entries = [
    { name: "Harvard Invitational", meta: "Nov 14–16, 2025 · Cambridge MA · LD", code: "HA237", status: "Active now", active: true, statusColor: "text-primary" },
    { name: "Greenhill Fall Classic", meta: "Sep 27–28, 2025 · Richardson TX · LD", code: "GH094", status: "5–2", active: false, statusColor: "text-muted-foreground" },
    { name: "Valley Invitational", meta: "Oct 11–12, 2025 · Las Vegas NV · LD", code: "VL188", status: "4–2", active: false, statusColor: "text-muted-foreground" },
  ];

  const upcoming = [
    { name: "Grapevine Classic", meta: "Dec 5–7, 2025 · Grapevine TX · LD", code: "GV412", status: "Registered", statusColor: "text-flow-gold" },
  ];

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        My Entries
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        Auto-loaded from your Tabroom account
      </p>

      <div className="flow-label mb-2">Current & Recent</div>
      {entries.map((e, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border mb-2 ${
            e.active ? "bg-flow-accent-light border-primary/20" : "bg-card border-border"
          }`}
        >
          <div>
            <div className="text-[13px] font-medium">{e.name}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{e.meta}</div>
          </div>
          <div className="text-right">
            <div className="bg-flow-surface2 rounded px-2 py-0.5 text-[11px] font-medium">{e.code}</div>
            <div className={`text-[10px] font-medium mt-1 ${e.statusColor}`}>{e.status}</div>
          </div>
        </div>
      ))}

      <div className="flow-label mt-3.5 mb-2">Upcoming</div>
      {upcoming.map((e, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card mb-2"
        >
          <div>
            <div className="text-[13px] font-medium">{e.name}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{e.meta}</div>
          </div>
          <div className="text-right">
            <div className="bg-flow-surface2 rounded px-2 py-0.5 text-[11px] font-medium">{e.code}</div>
            <div className={`text-[10px] font-medium mt-1 ${e.statusColor}`}>{e.status}</div>
          </div>
        </div>
      ))}

      <div className="mt-3.5 px-3 py-3 bg-flow-accent-light rounded-lg text-[11.5px] text-primary leading-[1.7]">
        ✦ These load automatically from Tabroom — no manual search needed. Flow checks for new entries hourly.
      </div>
    </div>
  );
}
