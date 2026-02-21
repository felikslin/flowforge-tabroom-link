import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// Helper: make authenticated request to Tabroom with cookie
async function tabroomFetch(path: string, token: string, options: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `${TABROOM_WEB}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Cookie: `TabroomToken=${token}`,
      ...(options.headers || {}),
    },
    redirect: "manual",
  });
  return res;
}

// ─── LOGIN ───────────────────────────────────────────────
// Tabroom's login endpoint: POST /user/login/login_save.mhtml
// On success: 302 redirect with TabroomToken cookie set
// On failure: 302 redirect to error page with empty/expired cookie
async function handleLogin(body: { email: string; password: string }) {
  if (!body.email || !body.password) {
    return err("Email and password are required");
  }

  try {
    const res = await fetch(`${TABROOM_WEB}/user/login/login_save.mhtml`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `username=${encodeURIComponent(body.email)}&password=${encodeURIComponent(body.password)}`,
      redirect: "manual",
    });

    const setCookie = res.headers.get("set-cookie") || "";
    const location = res.headers.get("location") || "";
    const responseText = await res.text();

    console.log("Login response:", res.status, "Location:", location);
    console.log("Set-Cookie:", setCookie);

    // Extract the TabroomToken from the cookie
    const tokenMatch = setCookie.match(/TabroomToken=([^;]+)/);
    const token = tokenMatch?.[1] || null;

    // Check if login failed: redirect contains "err=" or token is empty
    if (location.includes("err=") || !token || token === "") {
      const errMsg = decodeURIComponent(
        location.match(/err=([^&]*)/)?.[1] || "Invalid credentials"
      );
      return json({ error: errMsg, success: false }, 401);
    }

    // Login succeeded — now fetch user info from the home/dashboard page
    // The token gives us access to the user's data
    let personInfo: Record<string, unknown> = {};
    try {
      const dashRes = await tabroomFetch("/index/index.mhtml", token);
      const dashHtml = await dashRes.text();

      // Try to extract person_id and name from the dashboard HTML
      const personIdMatch = dashHtml.match(/person_id[=:]\s*["']?(\d+)/);
      const nameMatch = dashHtml.match(/Welcome[,\s]+([^<]+)/i) ||
        dashHtml.match(/class="[^"]*username[^"]*"[^>]*>([^<]+)/i);

      personInfo = {
        person_id: personIdMatch?.[1] || null,
        name: nameMatch?.[1]?.trim() || null,
      };
    } catch (e) {
      console.log("Could not fetch dashboard info:", e.message);
    }

    return json({
      success: true,
      token,
      person_id: personInfo.person_id || null,
      name: personInfo.name || body.email.split("@")[0],
      email: body.email,
    });
  } catch (e) {
    console.error("Login error:", e);
    return err(`Failed to connect to Tabroom: ${e.message}`, 502);
  }
}

// ─── MY TOURNAMENTS ──────────────────────────────────────
// Scrapes the user's tournament entries from their Tabroom dashboard
async function handleMyTournaments(body: { token: string }) {
  if (!body.token) return err("Token is required");

  try {
    const res = await tabroomFetch("/user/student/index.mhtml", body.token);
    const html = await res.text();

    // Parse tournament entries from the HTML
    const tournaments: Array<Record<string, string | null>> = [];
    const tournRegex = /tourn_id=(\d+)[^>]*>([^<]+)/g;
    let match;
    while ((match = tournRegex.exec(html)) !== null) {
      tournaments.push({
        id: match[1],
        name: match[2].trim(),
      });
    }

    // Also try to get more structured data if available
    const tableRows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];

    return json({
      tournaments,
      total: tournaments.length,
      html_preview: html.substring(0, 3000),
    });
  } catch (e) {
    console.error("Tournaments error:", e);
    return err(`Failed to fetch tournaments: ${e.message}`, 502);
  }
}

// ─── PAIRINGS ────────────────────────────────────────────
// Scrapes pairings for a specific tournament
async function handlePairings(body: {
  token: string;
  tourn_id: string;
  event_id?: string;
  round_id?: string;
}) {
  if (!body.token || !body.tourn_id) {
    return err("Token and tourn_id are required");
  }

  try {
    let path = `/index/tourn/postings/index.mhtml?tourn_id=${body.tourn_id}`;
    if (body.event_id) path += `&event_id=${body.event_id}`;
    if (body.round_id) path += `&round_id=${body.round_id}`;

    const res = await tabroomFetch(path, body.token);
    const html = await res.text();

    // Parse pairings table
    const pairings: Array<Record<string, string>> = [];
    const rowRegex = /<tr[^>]*class="[^"]*row[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const cells = match[1].match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
      const cellText = cells.map((c: string) =>
        c.replace(/<[^>]+>/g, "").trim()
      );
      if (cellText.length >= 3) {
        pairings.push({
          room: cellText[0] || "",
          aff: cellText[1] || "",
          neg: cellText[2] || "",
          judge: cellText[3] || "",
        });
      }
    }

    return json({
      pairings,
      total: pairings.length,
      html_preview: html.substring(0, 3000),
    });
  } catch (e) {
    console.error("Pairings error:", e);
    return err(`Failed to fetch pairings: ${e.message}`, 502);
  }
}

// ─── JUDGE PARADIGM (public — no auth needed) ────────────
async function handleJudge(body: { judge_id?: string; judge_name?: string }) {
  if (!body.judge_id && !body.judge_name) {
    return err("judge_id or judge_name is required");
  }

  try {
    if (body.judge_id) {
      const res = await fetch(
        `${TABROOM_WEB}/index/paradigm.mhtml?judge_person_id=${body.judge_id}`
      );
      const html = await res.text();

      // Extract paradigm text
      const paradigmMatch = html.match(
        /class="paradigm[^"]*"[^>]*>([\s\S]*?)<\/div>/
      );
      const nameMatch = html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/);

      return json({
        judge_id: body.judge_id,
        name: nameMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || "Unknown",
        paradigm:
          paradigmMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || null,
        html_preview: html.substring(0, 5000),
      });
    }

    // Try tournaments.tech first, fall back to Tabroom search
    try {
      const res = await fetch(
        `https://tournaments.tech/query?format=LD&term=${encodeURIComponent(body.judge_name!)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const text = await res.text();
      try {
        return json(JSON.parse(text));
      } catch {
        return json({ results: [], raw: text.substring(0, 2000) });
      }
    } catch (ttErr) {
      console.log("tournaments.tech unavailable, falling back to Tabroom search:", ttErr.message);
    }

    // Fallback: search Tabroom directly for the judge name
    const searchRes = await fetch(
      `${TABROOM_WEB}/index/paradigm.mhtml?search_first=${encodeURIComponent(
        body.judge_name!.split(" ")[0] || ""
      )}&search_last=${encodeURIComponent(
        body.judge_name!.split(" ").slice(1).join(" ") || body.judge_name!
      )}`
    );
    const searchHtml = await searchRes.text();

    // Extract judge links from search results
    const judgeResults: Array<Record<string, string | null>> = [];
    const linkRegex = /judge_person_id=(\d+)[^>]*>([^<]+)/g;
    let m;
    while ((m = linkRegex.exec(searchHtml)) !== null) {
      judgeResults.push({ judge_id: m[1], name: m[2].trim() });
    }

    // If exactly one result, fetch their paradigm directly
    if (judgeResults.length === 1) {
      const pRes = await fetch(
        `${TABROOM_WEB}/index/paradigm.mhtml?judge_person_id=${judgeResults[0].judge_id}`
      );
      const pHtml = await pRes.text();
      const paradigmMatch = pHtml.match(/class="paradigm[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      return json({
        judge_id: judgeResults[0].judge_id,
        name: judgeResults[0].name,
        paradigm: paradigmMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || null,
        source: "tabroom_fallback",
      });
    }

    return json({
      results: judgeResults,
      total: judgeResults.length,
      source: "tabroom_fallback",
      html_preview: searchHtml.substring(0, 3000),
    });
  } catch (e) {
    console.error("Judge error:", e);
    return err(`Failed to fetch judge info: ${e.message}`, 502);
  }
}

// ─── BALLOTS ─────────────────────────────────────────────
async function handleBallots(body: {
  token: string;
  tourn_id: string;
  entry_id?: string;
}) {
  if (!body.token || !body.tourn_id) {
    return err("Token and tourn_id are required");
  }

  try {
    let path = `/index/tourn/postings/entry_record.mhtml?tourn_id=${body.tourn_id}`;
    if (body.entry_id) path += `&entry_id=${body.entry_id}`;

    const res = await tabroomFetch(path, body.token);
    const html = await res.text();

    return json({
      html_preview: html.substring(0, 5000),
      note: "Parse ballot data from html_preview on the client side for maximum flexibility",
    });
  } catch (e) {
    console.error("Ballots error:", e);
    return err(`Failed to fetch ballots: ${e.message}`, 502);
  }
}

// ─── ROUTER ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

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
      return handleMyTournaments(body as { token: string });
    case "pairings":
      return handlePairings(
        body as { token: string; tourn_id: string; event_id?: string; round_id?: string }
      );
    case "judge":
      return handleJudge(body as { judge_id?: string; judge_name?: string });
    case "ballots":
      return handleBallots(
        body as { token: string; tourn_id: string; entry_id?: string }
      );
    default:
      return json({
        service: "Flow × Tabroom Proxy",
        endpoints: [
          "POST /login — { email, password } → { success, token, person_id, name }",
          "POST /my-tournaments — { token } → { tournaments[] }",
          "POST /pairings — { token, tourn_id, event_id?, round_id? } → { pairings[] }",
          "POST /judge — { judge_id? | judge_name? } → { name, paradigm } (public, no auth)",
          "POST /ballots — { token, tourn_id, entry_id? } → { html_preview }",
        ],
      });
  }
});
