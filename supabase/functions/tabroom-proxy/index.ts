import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABROOM_API = "https://api.tabroom.com/v1";
const TABROOM_WEB = "https://www.tabroom.com";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

// ─── LOGIN ───────────────────────────────────────────────
// Authenticates against Tabroom's internal API and returns session info
async function handleLogin(body: { email: string; password: string }) {
  if (!body.email || !body.password) {
    return err("Email and password are required");
  }

  try {
    // Tabroom uses a POST to /v1/login with form data
    const res = await fetch(`${TABROOM_API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: body.email,
        password: body.password,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Tabroom login failed:", res.status, text);
      return err("Invalid Tabroom credentials", 401);
    }

    const data = await res.json();

    // Extract session cookie from response headers
    const setCookie = res.headers.get("set-cookie") || "";
    const sessionMatch = setCookie.match(/tabroom_session=([^;]+)/);
    const sessionId = sessionMatch?.[1] || data?.session || null;

    return json({
      success: true,
      person_id: data?.person_id || data?.id,
      name: data?.first || data?.name,
      email: body.email,
      session: sessionId,
      // Pass through any other useful data Tabroom returns
      raw: data,
    });
  } catch (e) {
    console.error("Login error:", e);
    return err("Failed to connect to Tabroom", 502);
  }
}

// ─── MY TOURNAMENTS ──────────────────────────────────────
// Fetches the logged-in user's tournament entries
async function handleMyTournaments(body: {
  session: string;
  person_id: string;
}) {
  if (!body.session || !body.person_id) {
    return err("Session and person_id are required");
  }

  try {
    const res = await fetch(
      `${TABROOM_API}/user/${body.person_id}/tournaments`,
      {
        headers: {
          Cookie: `tabroom_session=${body.session}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      return err("Failed to fetch tournaments", res.status);
    }

    const data = await res.json();
    return json(data);
  } catch (e) {
    console.error("Tournaments error:", e);
    return err("Failed to fetch tournaments", 502);
  }
}

// ─── PAIRINGS ────────────────────────────────────────────
// Fetches pairings for a specific tournament round
async function handlePairings(body: {
  session: string;
  tourn_id: string;
  event_id?: string;
  round_id?: string;
}) {
  if (!body.session || !body.tourn_id) {
    return err("Session and tourn_id are required");
  }

  try {
    let url = `${TABROOM_API}/tourn/${body.tourn_id}/pairings`;
    const params = new URLSearchParams();
    if (body.event_id) params.set("event_id", body.event_id);
    if (body.round_id) params.set("round_id", body.round_id);
    if (params.toString()) url += `?${params}`;

    const res = await fetch(url, {
      headers: {
        Cookie: `tabroom_session=${body.session}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return err("Failed to fetch pairings", res.status);
    }

    const data = await res.json();
    return json(data);
  } catch (e) {
    console.error("Pairings error:", e);
    return err("Failed to fetch pairings", 502);
  }
}

// ─── JUDGE PARADIGM (public scraping) ────────────────────
// Scrapes judge paradigm from public Tabroom page
async function handleJudge(body: { judge_id?: string; judge_name?: string }) {
  if (!body.judge_id && !body.judge_name) {
    return err("judge_id or judge_name is required");
  }

  try {
    let url: string;
    if (body.judge_id) {
      url = `${TABROOM_WEB}/index/paradigm.mhtml?judge_person_id=${body.judge_id}`;
    } else {
      // Search by name via tournaments.tech
      url = `https://tournaments.tech/query?format=LD&term=${encodeURIComponent(
        body.judge_name!
      )}`;
    }

    const res = await fetch(url);
    const text = await res.text();

    // For paradigm pages, extract the paradigm text
    if (body.judge_id) {
      // Basic HTML parsing to extract paradigm content
      const paradigmMatch = text.match(
        /class="paradigm[^"]*"[^>]*>([\s\S]*?)<\/div>/
      );
      const nameMatch = text.match(
        /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/
      );

      return json({
        judge_id: body.judge_id,
        name: nameMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || "Unknown",
        paradigm: paradigmMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || null,
        raw_html: text.substring(0, 5000), // First 5KB for client-side parsing
      });
    }

    // For tournaments.tech query, return JSON directly
    try {
      const data = JSON.parse(text);
      return json(data);
    } catch {
      return json({ results: [], raw: text.substring(0, 2000) });
    }
  } catch (e) {
    console.error("Judge error:", e);
    return err("Failed to fetch judge info", 502);
  }
}

// ─── BALLOTS ─────────────────────────────────────────────
async function handleBallots(body: {
  session: string;
  tourn_id: string;
  entry_id?: string;
}) {
  if (!body.session || !body.tourn_id) {
    return err("Session and tourn_id are required");
  }

  try {
    let url = `${TABROOM_API}/tourn/${body.tourn_id}/ballots`;
    if (body.entry_id) url += `?entry_id=${body.entry_id}`;

    const res = await fetch(url, {
      headers: {
        Cookie: `tabroom_session=${body.session}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return err("Failed to fetch ballots", res.status);
    }

    const data = await res.json();
    return json(data);
  } catch (e) {
    console.error("Ballots error:", e);
    return err("Failed to fetch ballots", 502);
  }
}

// ─── ROUTER ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop(); // Get last segment

  if (req.method !== "POST") {
    return err("Only POST requests are supported", 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  switch (path) {
    case "login":
      return handleLogin(body as { email: string; password: string });
    case "my-tournaments":
      return handleMyTournaments(
        body as { session: string; person_id: string }
      );
    case "pairings":
      return handlePairings(
        body as {
          session: string;
          tourn_id: string;
          event_id?: string;
          round_id?: string;
        }
      );
    case "judge":
      return handleJudge(
        body as { judge_id?: string; judge_name?: string }
      );
    case "ballots":
      return handleBallots(
        body as { session: string; tourn_id: string; entry_id?: string }
      );
    default:
      return json({
        endpoints: [
          "POST /login — { email, password }",
          "POST /my-tournaments — { session, person_id }",
          "POST /pairings — { session, tourn_id, event_id?, round_id? }",
          "POST /judge — { judge_id? | judge_name? }",
          "POST /ballots — { session, tourn_id, entry_id? }",
        ],
      });
  }
});
