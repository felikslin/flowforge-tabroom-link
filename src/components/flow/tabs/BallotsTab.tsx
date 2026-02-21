export function BallotsTab() {
  const ballots = [
    {
      round: "Round 2 — vs. Priya Mehta",
      points: "29.1",
      result: "W",
      resultDetail: "(3-0)",
      rank: "2",
      rfd: '"Excellent 2AR crystallization — you made my job easy. Neg never recovered after you extended the impact turn in the 1AR. One note: slow down slightly on theory interps for clarity."',
      badges: [
        { label: "+0.7 above avg", variant: "accent" },
        { label: "Top 15% this round", variant: "gold" },
      ],
    },
    {
      round: "Round 1 — vs. Alex Chen",
      points: "28.4",
      result: "W",
      resultDetail: "(2-1)",
      rank: "3",
      rfd: '"Strong framework work on the aff. The neg\'s offense on contention 1 wasn\'t answered in the 1AR — make sure to extend that next time. Good clash overall, but watch your card quality on the second advantage."',
      badges: [],
    },
  ];

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Ballots & Points
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        Speaker points · RFDs · Round feedback
      </p>

      {ballots.map((b, i) => (
        <div key={i} className="flow-card mb-3">
          <div className="flow-label mb-2.5">{b.round}</div>

          <div className="grid grid-cols-3 gap-2.5 mb-3.5">
            <div className="bg-flow-surface2 rounded-lg p-3 text-center">
              <div className="font-serif text-[28px] font-normal text-primary leading-none">
                {b.points}
              </div>
              <div className="flow-label mt-1">Speaker pts</div>
            </div>
            <div className="bg-flow-surface2 rounded-lg p-3 text-center">
              <div className="font-serif text-[26px] font-normal text-primary leading-none">
                {b.result}
              </div>
              <div className="flow-label mt-1">Result {b.resultDetail}</div>
            </div>
            <div className="bg-flow-surface2 rounded-lg p-3 text-center">
              <div className="font-serif text-[28px] font-normal text-flow-gold leading-none">
                {b.rank}
              </div>
              <div className="flow-label mt-1">Rank</div>
            </div>
          </div>

          <div className="bg-card border-l-[3px] border-flow-gold px-3.5 py-3 rounded-r-lg text-xs leading-[1.8] italic text-muted-foreground">
            {b.rfd}
          </div>

          {b.badges.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2.5">
              {b.badges.map((badge, j) => (
                <span
                  key={j}
                  className={`px-2.5 py-1 rounded-full text-[10.5px] ${
                    badge.variant === "accent"
                      ? "bg-flow-accent-light text-primary"
                      : "bg-flow-gold-light text-flow-gold"
                  }`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
