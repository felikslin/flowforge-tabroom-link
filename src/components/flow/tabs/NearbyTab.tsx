import { useState } from "react";
import { MOCK_NEARBY } from "@/data/mock-data";

export function NearbyTab() {
  const [filter, setFilter] = useState("all");

  const filters = [
    { id: "all", label: "All" },
    { id: "food", label: "🍜 Food" },
    { id: "cafe", label: "☕ Café" },
    { id: "store", label: "🛒 Store" },
  ];

  const filtered = filter === "all" ? MOCK_NEARBY : MOCK_NEARBY.filter((p) => p.type === filter);

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Nearby Places
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        Around Harvard Square · Open now
      </p>

      <div className="flex gap-1 bg-flow-surface2 p-1 rounded-lg w-fit mb-3.5">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-md text-[11px] cursor-pointer border-none font-mono transition-all ${
              filter === f.id
                ? "bg-card text-foreground font-medium shadow-sm"
                : "text-muted-foreground bg-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flow-card">
        {filtered.map((place, i) => (
          <div
            key={i}
            className={`flex items-center gap-2.5 py-2.5 ${
              i < filtered.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <div className="w-[34px] h-[34px] rounded-lg bg-flow-surface2 flex items-center justify-center text-base flex-shrink-0">
              {place.icon}
            </div>
            <div>
              <div className="text-[12.5px] font-medium">{place.name}</div>
              <div className="text-[11px] text-muted-foreground">{place.meta}</div>
            </div>
            <div className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
              {place.dist}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
