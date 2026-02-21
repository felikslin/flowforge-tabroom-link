import { useState, useRef, useEffect } from "react";
import { useTabroom } from "@/contexts/TabroomContext";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "assistant" | "user";
  text: string;
}

export function ChatTab() {
  const { user, selectedTournament, pairings, judgeInfo, tournaments } = useTabroom();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: `Welcome to Flow, ${user.name.split(" ")[0]}! I have your live Tabroom data loaded. Ask me anything about your tournament, judge paradigms, strategy, or directions.` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);

  const initial = user.name[0]?.toUpperCase() || "?";

  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const context = {
        user: { name: user.name, email: user.email },
        tournament: selectedTournament,
        pairings: pairings.slice(0, 10),
        judgeInfo,
        allTournaments: tournaments.map((t) => ({ id: t.id, name: t.name })),
      };

      const chatMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.text })),
        { role: "user" as const, content: text },
      ];

      const { data, error } = await supabase.functions.invoke("flow-chat", {
        body: { messages: chatMessages, context },
      });

      if (error) throw error;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.reply || "I couldn't generate a response." },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Sorry, I encountered an error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const chips = [
    "Tell me about my current pairings",
    "What tournaments am I entered in?",
    "Give me a pep talk",
    "Help me prep for my next round",
  ];

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Ask Flow
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        AI assistant with live tournament context
      </p>

      <div className="flow-card">
        <div ref={msgsRef} className="flex flex-col gap-3 max-h-[300px] overflow-y-auto mb-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 items-start ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center text-[11px] ${
                  msg.role === "assistant"
                    ? "bg-primary text-primary-foreground"
                    : "bg-flow-surface2 border border-border"
                }`}
              >
                {msg.role === "assistant" ? "✦" : initial}
              </div>
              <div
                className={`px-3.5 py-2.5 text-xs leading-[1.7] max-w-[84%] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-[10px_0_10px_10px]"
                    : "bg-flow-surface2 rounded-[0_10px_10px_10px]"
                }`}
                dangerouslySetInnerHTML={{
                  __html: msg.text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>"),
                }}
              />
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-start">
              <div className="w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center text-[11px] bg-primary text-primary-foreground">
                ✦
              </div>
              <div className="px-3.5 py-2.5 text-xs bg-flow-surface2 rounded-[0_10px_10px_10px]">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask Flow anything..."
            className="flex-1 border border-border rounded-lg px-3 py-2.5 font-mono text-xs bg-background text-foreground outline-none transition-colors focus:border-primary"
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading}
            className="bg-primary text-primary-foreground border-none rounded-lg px-3.5 py-2.5 text-[13px] cursor-pointer disabled:opacity-50"
          >
            ↑
          </button>
        </div>

        <div className="flex gap-1.5 flex-wrap mt-2">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => setInput(chip)}
              className="bg-flow-surface2 border border-border rounded-full px-2.5 py-1 text-[10.5px] cursor-pointer text-muted-foreground font-mono transition-all hover:bg-flow-accent-light hover:text-primary hover:border-primary/20"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
