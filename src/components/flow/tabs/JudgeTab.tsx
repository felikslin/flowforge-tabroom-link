export function JudgeTab() {
  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Judge Info
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        Round 3 · Michael Okafor
      </p>

      <div className="flow-card">
        <div className="flex justify-between items-start mb-3.5">
          <div>
            <div className="text-[15px] font-medium">Michael Okafor</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Yale University · 4th year judge
            </div>
          </div>
          <div className="bg-flow-gold-light text-flow-gold border border-flow-gold/30 rounded-lg px-3.5 py-2 text-center">
            <div className="font-serif text-[22px] font-normal leading-tight">58%</div>
            <div className="flow-label mt-px">AFF rate</div>
          </div>
        </div>

        {/* Paradigm */}
        <div className="bg-flow-surface2 rounded-lg p-3.5 text-xs leading-[1.9] max-h-[220px] overflow-y-auto italic border-l-[3px] border-border">
          "I vote on the flow. Spreading is fine if you're clear — slow down on tags and author
          names. I default to competing interpretations on theory, but am persuadable to
          reasonability with a clear brightline. Offense-defense is my default decision calculus.
          Don't read frivolous shells. I enjoy good K debates but you need to win the link. Phil
          is fine — just make sure your framework interacts with the rest of the round."
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {[
            { label: "✓ K affs", variant: "g" },
            { label: "✓ Policy", variant: "g" },
            { label: "✓ Phil", variant: "g" },
            { label: "✗ Frivolous T", variant: "r" },
            { label: "✗ Blippy spikes", variant: "r" },
            { label: "~ Theory", variant: "n" },
          ].map((tag) => (
            <span
              key={tag.label}
              className={`text-[10.5px] px-2.5 py-1 rounded-full font-medium ${
                tag.variant === "g"
                  ? "bg-flow-accent-light text-primary"
                  : tag.variant === "r"
                  ? "bg-flow-warn-light text-destructive"
                  : "bg-flow-surface2 text-muted-foreground"
              }`}
            >
              {tag.label}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3.5">
          {[
            { n: "14", label: "AFF votes", color: "text-primary" },
            { n: "10", label: "NEG votes", color: "text-destructive" },
            { n: "24", label: "Total", color: "text-flow-gold" },
          ].map((stat) => (
            <div key={stat.label} className="bg-flow-surface2 rounded-lg p-2.5 text-center">
              <div className={`font-serif text-[22px] font-normal ${stat.color}`}>
                {stat.n}
              </div>
              <div className="flow-label mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
