import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are Flow, an AI debate tournament assistant. You help debaters during live tournaments with concise, actionable advice.

You have access to the user's LIVE tournament context:
${context ? JSON.stringify(context, null, 2) : "No tournament context available."}

Guidelines:
- Be concise and direct — debaters are busy between rounds
- Use debate terminology naturally (flow, spreading, RFD, speaks, etc.)
- When discussing the user's record, reference their actual round data
- When analyzing speaker points, calculate trends and compare to averages
- When giving strategic advice, consider their opponent, judge paradigm, and side
- Offer round-by-round breakdown when asked about performance
- Reference past tournament results when relevant
- Format important info with **bold** and use line breaks for readability
- Keep responses under 200 words unless the user asks for detail`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 800,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || "AI request failed" }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ reply: data.choices?.[0]?.message?.content || "I couldn't generate a response." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
