import type { TabId } from "@/types/flow";

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const SECTIONS = [
  {
    label: "Tournament",
    items: [
      { id: "rounds" as TabId, icon: "🏛", label: "My Rounds" },
      { id: "pairings" as TabId, icon: "📋", label: "All Pairings" },
      { id: "judge" as TabId, icon: "⚖️", label: "Judge Info" },
      { id: "nav" as TabId, icon: "🗺", label: "Navigation" },
    ],
  },
  {
    label: "My Account",
    items: [
      { id: "ballots" as TabId, icon: "📊", label: "Ballots & Points" },
      { id: "entries" as TabId, icon: "🗂", label: "My Entries" },
    ],
  },
  {
    label: "Off-Site",
    items: [
      { id: "nearby" as TabId, icon: "🍜", label: "Nearby", badge: "3" },
      { id: "chat" as TabId, icon: "✦", label: "Ask Flow" },
    ],
  },
];

export function FlowSidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-[210px] flex-shrink-0 bg-card border-r border-border flex flex-col overflow-y-auto py-4">
      {SECTIONS.map((section) => (
        <div key={section.label} className="px-2.5 mb-5">
          <div className="flow-label px-2 mb-1">{section.label}</div>
          {section.items.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] cursor-pointer text-xs transition-colors select-none text-left ${
                activeTab === item.id
                  ? "bg-flow-accent-light text-primary font-medium"
                  : "text-foreground hover:bg-flow-surface2"
              }`}
            >
              <span className="text-sm flex-shrink-0">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-[9.5px] px-1.5 py-px rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
