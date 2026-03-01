// Cloudflare Workers entry point
// Routes to tabroom-proxy, flow-chat, and nearby-places handlers

import { handleTabroomProxy } from './tabroom-proxy.ts';
import { handleFlowChat } from './flow-chat.ts';
import { handleNearbyPlaces } from './nearby-places.ts';

export interface Env {
  LOVABLE_API_KEY: string;
  GOOGLE_MAPS_API_KEY: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route to appropriate handler
      if (path.startsWith('/api/tabroom/')) {
        return handleTabroomProxy(request, env);
      } else if (path === '/api/flow-chat') {
        return handleFlowChat(request, env);
      } else if (path === '/api/nearby-places') {
        return handleNearbyPlaces(request, env);
      }

      // Default response
      return new Response(
        JSON.stringify({
          service: 'Flow × Tabroom Workers',
          endpoints: [
            'POST /api/tabroom/*',
            'POST /api/flow-chat',
            'POST /api/nearby-places',
          ],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
