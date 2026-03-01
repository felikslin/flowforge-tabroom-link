// Tabroom Proxy handler for Cloudflare Workers
import type { Env } from './index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const TABROOM_WEB = 'https://www.tabroom.com';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function tabroomFetch(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${TABROOM_WEB}${path}`;
  const decodedToken = decodeURIComponent(token);
  const cookieStr = `TabroomToken=${decodedToken}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Cookie: cookieStr,
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
    redirect: 'follow',
  });
  return res;
}

// ─── LOGIN ───────────────────────────────────────────────
async function handleLogin(body: { email: string; password: string }) {
  if (!body.email || !body.password) return err('Email and password are required');

  try {
    const res = await fetch(`${TABROOM_WEB}/user/login/login_save.mhtml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': BROWSER_UA },
      body: `username=${encodeURIComponent(body.email)}&password=${encodeURIComponent(
        body.password
      )}`,
      redirect: 'manual',
    });

    const setCookie = res.headers.get('set-cookie') || '';
    const location = res.headers.get('location') || '';
    await res.text();

    const tokenMatch = setCookie.match(/TabroomToken=([^;]+)/);
    const token = tokenMatch?.[1] || null;

    if (location.includes('err=') || !token || token === '') {
      const errMsg = decodeURIComponent(location.match(/err=([^&]*)/)?.[1] || 'Invalid credentials');
      return json({ error: errMsg, success: false }, 401);
    }

    let personInfo: Record<string, unknown> = { person_id: null, name: null };

    // Strategy 1: Home page may have "Welcome, Name" or profile info
    const pagesToTry = ['/user/home.mhtml', '/user/login/profile.mhtml'];
    for (const page of pagesToTry) {
      try {
        const dashRes = await tabroomFetch(page, token);
        const dashHtml = await dashRes.text();
        if (isLoginPage(dashHtml)) continue;

        // Extract person_id
        if (!personInfo.person_id) {
          const pidMatch =
            dashHtml.match(/person_id[=:]\s*["']?(\d+)/) ||
            dashHtml.match(/personId[=:]\s*["']?(\d+)/);
          if (pidMatch) personInfo.person_id = pidMatch[1];
        }

        // Try form fields for name
        if (!personInfo.name) {
          const firstMatch =
            dashHtml.match(/name\s*=\s*"first"[^>]*value\s*=\s*"([^"]+)"/i) ||
            dashHtml.match(/name\s*=\s*"first_name"[^>]*value\s*=\s*"([^"]+)"/i) ||
            dashHtml.match(/value\s*=\s*"([^"]+)"[^>]*name\s*=\s*"first"/i);
          const lastMatch =
            dashHtml.match(/name\s*=\s*"last"[^>]*value\s*=\s*"([^"]+)"/i) ||
            dashHtml.match(/name\s*=\s*"last_name"[^>]*value\s*=\s*"([^"]+)"/i) ||
            dashHtml.match(/value\s*=\s*"([^"]+)"[^>]*name\s*=\s*"last"/i);
          if (firstMatch?.[1] && lastMatch?.[1]) {
            personInfo.name = `${firstMatch[1].trim()} ${lastMatch[1].trim()}`;
            console.log(`Login: Found name from form fields on ${page}: "${personInfo.name}"`);
          }
        }

        // Try heading patterns
        if (!personInfo.name) {
          const welcomeMatch = dashHtml.match(/Welcome[,\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
          if (welcomeMatch?.[1]) {
            personInfo.name = welcomeMatch[1].trim();
            console.log(`Login: Found name from welcome on ${page}: "${personInfo.name}"`);
          }
        }

        const inputFields = (dashHtml.match(/<input[^>]*(?:first|last|name)[^>]*>/gi) || []).slice(
          0,
          3
        );
        if (inputFields.length > 0)
          console.log(`Login: Input fields on ${page}: ${JSON.stringify(inputFields)}`);

        if (personInfo.person_id && personInfo.name) break;
      } catch (e) {
        console.log(`Login: Could not fetch ${page}:`, (e as Error).message);
      }
    }

    // Strategy 2: Student index page for person_id
    if (!personInfo.person_id) {
      try {
        const res = await tabroomFetch('/user/student/index.mhtml', token);
        const html = await res.text();
        if (!isLoginPage(html)) {
          const pidMatch =
            html.match(/person_id[=:]\s*["']?(\d+)/) || html.match(/personId[=:]\s*["']?(\d+)/);
          if (pidMatch) personInfo.person_id = pidMatch[1];
        }
      } catch {
        /* skip */
      }
    }

    // Strategy 3: Extract name from past-results entries
    if (!personInfo.name && personInfo.person_id) {
      try {
        const prRes = await tabroomFetch(
          `/index/results/ranked_list.mhtml?person_id=${personInfo.person_id}`,
          token
        );
        const prHtml = await prRes.text();
        if (!isLoginPage(prHtml)) {
          const headingMatches = prHtml.matchAll(/<h[1-4][^>]*>\s*([\s\S]*?)\s*<\/h[1-4]>/gi);
          for (const hm of headingMatches) {
            const text = hm[1].replace(/<[^>]+>/g, '').trim();
            if (
              text.length >= 4 &&
              text.length < 40 &&
              /^[A-Z]/.test(text) &&
              !/not found|tabroom|log in|results|search/i.test(text) &&
              /\s/.test(text)
            ) {
              personInfo.name = text;
              console.log(`Login: Found name from ranked_list heading: "${personInfo.name}"`);
              break;
            }
          }
        }
      } catch {
        /* skip */
      }
    }

    console.log(`Login: Final person_id=${personInfo.person_id}, name=${personInfo.name}`);

    return json({
      success: true,
      token,
      person_id: personInfo.person_id || null,
      name: personInfo.name || body.email.split('@')[0],
      email: body.email,
    });
  } catch (e) {
    return err(`Failed to connect to Tabroom: ${(e as Error).message}`, 502);
  }
}

// ─── MY TOURNAMENTS ──────────────────────────────────────
async function handleMyTournaments(body: { token: string }) {
  if (!body.token) return err('Token is required');
  try {
    const res = await tabroomFetch('/user/student/index.mhtml', body.token);
    const html = await res.text();

    const tournaments: Array<Record<string, string | null>> = [];
    const tournRegex = /tourn_id=(\d+)[^>]*>([^<]+)/g;
    let match;
    while ((match = tournRegex.exec(html)) !== null) {
      tournaments.push({ id: match[1], name: match[2].trim() });
    }

    return json({ tournaments, total: tournaments.length, html_preview: html.substring(0, 3000) });
  } catch (e) {
    return err(`Failed to fetch tournaments: ${(e as Error).message}`, 502);
  }
}

// ─── PAIRINGS EVENTS ──────────────────────────────────────
async function handlePairingsEvents(body: { token: string; tourn_id: string }) {
  if (!body.token || !body.tourn_id) return err('Token and tourn_id are required');
  try {
    const indexPath = `/index/tourn/postings/index.mhtml?tourn_id=${body.tourn_id}`;
    const res = await tabroomFetch(indexPath, body.token);
    const html = await res.text();
    if (isLoginPage(html)) return err('Session expired - please log in again', 401);

    const eventMap = new Map<
      string,
      { id: string; name: string; rounds: Array<{ id: string; name: string }> }
    >();
    
    let m: RegExpExecArray | null;
    
    // Method 1: Find the event selector dropdown (handle spaces around = sign)
    const selectEventRegex = /<select[^>]*(?:id|name)\s*=\s*["']eventSelector["'][^>]*>([\s\S]*?)<\/select>/gi;
    const selectMatch = selectEventRegex.exec(html);
    
    if (selectMatch) {
      const selectContent = selectMatch[1];
      // Extract option elements with value and text (handle spaces around = sign)
      const optionRegex = /<option[^>]*value\s*=\s*["'](\d+)["'][^>]*>([^<]+)<\/option>/gi;
      while ((m = optionRegex.exec(selectContent)) !== null) {
        const id = m[1];
        const rawName = m[2]
          .replace(/&amp;/g, '&')
          .replace(/&#\d+;/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (id && rawName && rawName.length > 1) {
          eventMap.set(id, { id, name: rawName, rounds: [] });
        }
      }
    }
    
    // Method 2: If no eventSelector found, look for event links with event_id parameter
    if (eventMap.size === 0) {
      const eventLinkRegex = /<a[^>]*href="[^"]*[?&]event_id=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/gi;
      while ((m = eventLinkRegex.exec(html)) !== null) {
        const id = m[1];
        const rawName = m[2]
          .replace(/&amp;/g, '&')
          .replace(/&#\d+;/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (id && rawName && rawName.length > 2 && !eventMap.has(id)) {
          eventMap.set(id, { id, name: rawName, rounds: [] });
        }
      }
    }
    
    // Method 3: Look for event_id in URL parameters within the page
    if (eventMap.size === 0) {
      const urlEventRegex = /tourn_id=\d+[^"']*event_id=(\d+)/gi;
      const foundEventIds = new Set<string>();
      while ((m = urlEventRegex.exec(html)) !== null) {
        foundEventIds.add(m[1]);
      }
      // For each found event_id, try to fetch its details
      for (const eventId of foundEventIds) {
        try {
          const eventPath = `/index/tourn/postings/index.mhtml?tourn_id=${body.tourn_id}&event_id=${eventId}`;
          const eventRes = await tabroomFetch(eventPath, body.token);
          const eventHtml = await eventRes.text();
          // Try to extract event name from title or h tags
          const titleMatch = /<title>([^<]+)<\/title>/i.exec(eventHtml) || /<h2[^>]*>([^<]+)<\/h2>/i.exec(eventHtml);
          if (titleMatch) {
            const eventName = titleMatch[1].replace(/Tabroom\.com/g, '').replace(/\s+/g, ' ').trim();
            if (eventName && !eventMap.has(eventId)) {
              eventMap.set(eventId, { id: eventId, name: eventName, rounds: [] });
            }
          }
        } catch {
          // Skip if we can't fetch
        }
      }
    }

    const events: Array<{ id: string; name: string; rounds: Array<{ id: string; name: string }> }> =
      [];
    
    // Extract rounds for each event from the eventListing divs in the same HTML
    for (const [eventId, event] of eventMap.entries()) {
      // Find the div with id matching this event ID - look for eventListing class with this specific id
      const eventDivRegex = new RegExp(`<div[^>]*id="${eventId}"[^>]*class="[^"]*eventListing[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, 'gi');
      let eventDivMatch = eventDivRegex.exec(html);
      
      // Try alternative: class before id
      if (!eventDivMatch) {
        const altRegex = new RegExp(`<div[^>]*class="[^"]*eventListing[^"]*"[^>]*id="${eventId}"[^>]*>([\\s\\S]*?)<\\/div>`, 'gi');
        eventDivMatch = altRegex.exec(html);
      }
      
      if (eventDivMatch) {
        const eventDivContent = eventDivMatch[1];
        // Extract round links: <a href="/index/tourn/postings/round.mhtml?tourn_id=38592&round_id=1457445">CONG Ses1</a>
        const roundRegex = /<a[^>]*href="[^"]*round_id=(\d+)"[^>]*>([^<]+)<\/a>/gi;
        let rm: RegExpExecArray | null;
        while ((rm = roundRegex.exec(eventDivContent)) !== null) {
          const rid = rm[1];
          const rname = rm[2]
            .replace(/&amp;/g, '&')
            .replace(/&#\d+;/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (rid && rname && !event.rounds.find((r) => r.id === rid)) {
            event.rounds.push({ id: rid, name: rname });
          }
        }
      }
      
      // Always add event even if no rounds found (some events might not have started yet)
      events.push(event);
    }
    
    // Method 4: If still no events found, this might be a single-event tournament
    // Look for direct round links and create a single event
    if (events.length === 0) {
      const directRoundRegex = /<a[^>]*href="[^"]*round_id=(\d+)"[^>]*>([^<]+)<\/a>/gi;
      const directRounds: Array<{ id: string; name: string }> = [];
      while ((m = directRoundRegex.exec(html)) !== null) {
        const rid = m[1];
        const rname = m[2]
          .replace(/&amp;/g, '&')
          .replace(/&#\d+;/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (rid && rname && !directRounds.find((r) => r.id === rid)) {
          directRounds.push({ id: rid, name: rname });
        }
      }
      
      if (directRounds.length > 0) {
        // Try to extract event name from various sources
        let eventName = 'Tournament Rounds';
        
        // Try page title first (often contains event name)
        const titleMatch = /<title>([^<]+?)\s*(?:-|—|–)?\s*Tabroom\.com<\/title>/i.exec(html);
        if (titleMatch) {
          const titleText = titleMatch[1].trim();
          // Skip if it's just the tournament name (typically in h2)
          const h2Match = /<h2[^>]*>([^<]+)<\/h2>/i.exec(html);
          if (h2Match && titleText !== h2Match[1].trim()) {
            eventName = titleText;
          }
        }
        
        // Try to find event name from h4 or h5 tags (often used for event names)
        if (eventName === 'Tournament Rounds') {
          const h4Match = /<h4[^>]*>(?!Schematics)([^<]+)<\/h4>/i.exec(html);
          if (h4Match) {
            eventName = h4Match[1].replace(/\s+/g, ' ').trim();
          }
        }
        
        // Last resort: use the first few words of the first round name
        if (eventName === 'Tournament Rounds' && directRounds.length > 0) {
          const firstRound = directRounds[0].name;
          // Extract event abbreviation (e.g., "PF" from "PF R1")
          const abbrevMatch = /^([A-Z]{2,6})\s+/i.exec(firstRound);
          if (abbrevMatch) {
            eventName = abbrevMatch[1];
          }
        }
        
        events.push({
          id: 'single',
          name: eventName,
          rounds: directRounds
        });
      }
    }

    return json({ events, total: events.length });
  } catch (e) {
    return err(`Failed to fetch pairings events: ${(e as Error).message}`, 502);
  }
}

// ─── PAIRINGS (for specific round) ────────────────────────
async function handlePairings(body: { token: string; round_id: string }) {
  if (!body.token || !body.round_id) return err('Token and round_id are required');
  try {
    const roundPath = `/index/tourn/postings/round.mhtml?round_id=${body.round_id}`;
    const res = await tabroomFetch(roundPath, body.token);
    const html = await res.text();
    if (isLoginPage(html)) return err('Session expired - please log in again', 401);

    // Extract table with id matching round_id
    const tableRegex = new RegExp(`<table[^>]*id=["']${body.round_id}["'][^>]*>([\\s\\S]*?)<\\/table>`, 'gi');
    const tableMatch = tableRegex.exec(html);
    
    if (!tableMatch) {
      return json({ pairings: [], headers: [], message: 'No pairings table found' });
    }
    
    const tableContent = tableMatch[0];
    
    // Extract headers from thead
    const headers: string[] = [];
    const theadRegex = /<thead>([\s\S]*?)<\/thead>/gi;
    const theadMatch = theadRegex.exec(tableContent);
    
    if (theadMatch) {
      const thRegex = /<th[^>]*>([^<]+)</gi;
      let thMatch: RegExpExecArray | null;
      while ((thMatch = thRegex.exec(theadMatch[1])) !== null) {
        const header = thMatch[1]
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_');
        if (header) headers.push(header);
      }
    }
    
    // Extract rows from tbody
    const pairings: Array<Record<string, string>> = [];
    const tbodyRegex = /<tbody>([\s\S]*?)<\/tbody>/gi;
    const tbodyMatch = tbodyRegex.exec(tableContent);
    
    if (tbodyMatch) {
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch: RegExpExecArray | null;
      
      while ((rowMatch = rowRegex.exec(tbodyMatch[1])) !== null) {
        const rowHtml = rowMatch[1];
        const cells: string[] = [];
        
        // Extract td content
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let tdMatch: RegExpExecArray | null;
        
        while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
          let cellContent = tdMatch[1];
          
          // Extract text from spans, removing HTML tags
          cellContent = cellContent
            .replace(/<span[^>]*class=["'][^"']*fa[^"']*["'][^>]*>.*?<\/span>/gi, '') // Remove font-awesome icons
            .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
            .replace(/&amp;/g, '&')
            .replace(/&#\d+;/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          cells.push(cellContent);
        }
        
        // Map cells to headers
        if (cells.length > 0) {
          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = cells[index] || '';
          });
          pairings.push(row);
        }
      }
    }
    
    return json({ 
      pairings, 
      headers,
      total: pairings.length 
    });
  } catch (e) {
    return err(`Failed to fetch pairings: ${(e as Error).message}`, 502);
  }
}

// (Truncating for brevity - continued in next comment with remaining functions)
function isLoginPage(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('log in to tabroom') ||
    lower.includes('please login to view') ||
    lower.includes('login session has expired') ||
    lower.includes('please log in again') ||
    lower.includes('showloginbox') ||
    (lower.includes('password') &&
      lower.includes('email') &&
      lower.includes('create a new account'))
  );
}

// Export the main handler
export async function handleTabroomProxy(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(request.url);
  const path = url.pathname.split('/').pop();

  if (request.method !== 'POST') return err('Only POST requests are supported', 405);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as any;
  } catch {
    return err('Invalid JSON body');
  }

  switch (path) {
    case 'login':
      return handleLogin(body as any);
    case 'my-tournaments':
      return handleMyTournaments(body as any);
    case 'pairings-events':
      return handlePairingsEvents(body as any);
    case 'pairings':
      return handlePairings(body as any);
    // Add other handlers here
    default:
      return json({
        service: 'Flow × Tabroom Proxy',
        endpoints: [
          'POST /login',
          'POST /my-tournaments',
          'POST /pairings',
          'POST /judge',
          'POST /ballots',
          'POST /my-rounds',
          'POST /entries',
          'POST /upcoming',
          'POST /past-results',
        ],
      });
  }
}
