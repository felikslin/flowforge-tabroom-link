import { useState, useRef, useEffect } from "react";
import { CHAT_REPLIES } from "@/data/mock-data";
import type { FlowUser } from "@/types/flow";

interface ChatTabProps {
  user: FlowUser;
}

interface Message {
  role: "ai" | "me";
  text: string;
}

function findReply(text: string): string {
  const t = text.toLowerCase();
  if (/get to|direction|sever|room|where|navigation/.test(t)) return CHAT_REPLIES.dir;
  if (/judge|okafor|paradigm/.test(t)) return CHAT_REPLIES.judge;
  if (/point|speak|ballot|score/.test(t)) return CHAT_REPLIES.points;
  if (/record|win|standing|elim/.test(t)) return CHAT_REPLIES.record;
  if (/pep|motivat|hype|nervous|confident/.test(t)) return CHAT_REPLIES.pep;
  if (/food|eat|coffee|hungry/.test(t)) return CHAT_REPLIES.food;
  return "In the full app, this calls the AI API with your live Tabroom context loaded. Try: 'directions', 'judge info', 'my speaker points', 'my record', or 'pep talk'!";
}

export function ChatTab({ user }: ChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: `Welcome to Flow, ${user.name.split(" ")[0]}! I have your live Tabroom data loaded. Ask me about your rounds, judge, directions, or anything else.` },
    { role: "me", text: "How do I get to my next room?" },
    { role: "ai", text: CHAT_REPLIES.dir },
  ]);
  const [input, setInput] = useState("");
  const msgsRef = useRef<HTMLDivElement>(null);

  const initial = user.name[0]?.toUpperCase() || "?";

  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "me", text }]);
    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "ai", text: findReply(text) }]);
    }, 420);
  };

  const chips = [
    "How do I get to Sever 107?",
    "Tell me about my judge",
    "What are my speaker points?",
    "Give me a pep talk",
    "Where can I eat nearby?",
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
              className={`flex gap-2 items-start ${msg.role === "me" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center text-[11px] ${
                  msg.role === "ai"
                    ? "bg-primary text-primary-foreground"
                    : "bg-flow-surface2 border border-border"
                }`}
              >
                {msg.role === "ai" ? "✦" : initial}
              </div>
              <div
                className={`px-3.5 py-2.5 text-xs leading-[1.7] max-w-[84%] ${
                  msg.role === "me"
                    ? "bg-primary text-primary-foreground rounded-[10px_0_10px_10px]"
                    : "bg-flow-surface2 rounded-[0_10px_10px_10px]"
                }`}
                dangerouslySetInnerHTML={{
                  __html: msg.text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>"),
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask Flow anything..."
            className="flex-1 border border-border rounded-lg px-3 py-2.5 font-mono text-xs bg-background text-foreground outline-none transition-colors focus:border-primary"
          />
          <button
            onClick={send}
            className="bg-primary text-primary-foreground border-none rounded-lg px-3.5 py-2.5 text-[13px] cursor-pointer"
          >
            ↑
          </button>
        </div>

        <div className="flex gap-1.5 flex-wrap mt-2">
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => {
                setInput(chip);
              }}
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
