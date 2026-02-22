import { useState, useEffect } from "react";
import type { FlowUser, TabId } from "@/types/flow";
import { LoginScreen } from "@/components/flow/LoginScreen";
import { FlowHeader } from "@/components/flow/FlowHeader";
import { FlowSidebar } from "@/components/flow/FlowSidebar";
import { FlowRightPanel } from "@/components/flow/FlowRightPanel";
import { MyRoundsTab } from "@/components/flow/tabs/MyRoundsTab";
import { PairingsTab } from "@/components/flow/tabs/PairingsTab";
import { JudgeTab } from "@/components/flow/tabs/JudgeTab";
import { NavigationTab } from "@/components/flow/tabs/NavigationTab";
import { ResultsTab } from "@/components/flow/tabs/ResultsTab";
import { NearbyTab } from "@/components/flow/tabs/NearbyTab";
import { ChatTab } from "@/components/flow/tabs/ChatTab";
import { HistoryTab } from "@/components/flow/tabs/HistoryTab";
import { TabroomProvider } from "@/contexts/TabroomContext";

const Index = () => {
  const [user, setUser] = useState<FlowUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("rounds");

  useEffect(() => {
    const saved = localStorage.getItem("flow_user");
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("flow_user");
    setUser(null);
    setActiveTab("rounds");
  };

  if (!user) return <LoginScreen onLoginSuccess={setUser} />;

  const renderTab = () => {
    switch (activeTab) {
      case "rounds": return <MyRoundsTab onTabChange={setActiveTab} />;
      case "pairings": return <PairingsTab />;
      case "judge": return <JudgeTab />;
      case "nav": return <NavigationTab />;
      case "results": return <ResultsTab />;
      case "nearby": return <NearbyTab />;
      case "chat": return <ChatTab />;
      case "history": return <HistoryTab />;
      default: return <MyRoundsTab onTabChange={setActiveTab} />;
    }
  };

  return (
    <TabroomProvider user={user}>
      <div className="h-full flex flex-col bg-background">
        <FlowHeader onSignOut={handleSignOut} />
        <div className="flex flex-1 overflow-hidden">
          <FlowSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <main className="flex-1 overflow-y-auto p-5">{renderTab()}</main>
          <FlowRightPanel onSignOut={handleSignOut} />
        </div>
      </div>
    </TabroomProvider>
  );
};

export default Index;
