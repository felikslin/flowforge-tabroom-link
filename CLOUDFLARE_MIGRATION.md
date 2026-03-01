# Cloudflare Workers Migration Guide

This project has been migrated from Supabase Edge Functions to Cloudflare Workers for easier deployment and better performance.

## What Changed

- **Backend**: Moved from Supabase Edge Functions to Cloudflare Workers
- **API Calls**: Frontend now makes direct HTTP requests instead of using Supabase SDK
- **Environment**: Simpler setup with just environment variables (no Supabase project needed)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This will install Wrangler (Cloudflare's CLI) and other dependencies.

### 2. Set Up Environment Variables

#### Frontend (.env file in project root):
```env
VITE_API_BASE_URL=http://localhost:8787
```

For production, change to your deployed Worker URL:
```env
VITE_API_BASE_URL=https://your-worker.workers.dev
```

#### Cloudflare Workers (via Wrangler):
Set these secrets for your worker:

```bash
# Set the Lovable AI API key (for flow-chat)
wrangler secret put LOVABLE_API_KEY

# Set the Google Maps API key (for nearby-places)
wrangler secret put GOOGLE_MAPS_API_KEY
```

### 3. Local Development

Run the frontend and backend simultaneously:

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Cloudflare Worker:**
```bash
npm run dev:worker
```

The Worker will run on `http://localhost:8787` by default.

### 4. Deploy to Production

#### Deploy the Worker:
```bash
# Login to Cloudflare (first time only)
wrangler login

# Deploy your worker
npm run worker:deploy
```

This will give you a URL like: `https://flowforge-tabroom-workers.your-subdomain.workers.dev`

#### Update Frontend Environment:
Update your production `.env` file with the deployed Worker URL:
```env
VITE_API_BASE_URL=https://flowforge-tabroom-workers.your-subdomain.workers.dev
```

#### Deploy Frontend:
Deploy your frontend to your hosting provider (Vercel, Netlify, etc.) with the updated environment variable.

### 5. Configure Worker Secrets (Production)

After deploying, set your secrets:
```bash
wrangler secret put LOVABLE_API_KEY
wrangler secret put GOOGLE_MAPS_API_KEY
```

## API Endpoints

The Worker exposes these endpoints:

- `POST /api/tabroom/login` - Tabroom authentication
- `POST /api/tabroom/my-tournaments` - Get user tournaments
- `POST /api/tabroom/pairings` - Get tournament pairings
- `POST /api/tabroom/judge` - Get judge paradigms
- `POST /api/tabroom/ballots` - Get ballot results
- `POST /api/tabroom/my-rounds` - Get user rounds
- `POST /api/tabroom/entries` - Get tournament entries
- `POST /api/tabroom/upcoming` - Get upcoming tournaments
- `POST /api/tabroom/past-results` - Get past results
- `POST /api/tabroom/venue-map` - Get venue information
- `POST /api/flow-chat` - AI chat assistant
- `POST /api/nearby-places` - Find nearby places

## Benefits of Cloudflare Workers

1. **Simpler Setup**: No Supabase project required
2. **Free Tier**: 100,000 requests/day for free
3. **Global Edge Network**: Faster response times worldwide
4. **Easy Deployment**: Single command deployment with `wrangler`
5. **Local Development**: Built-in local dev server
6. **Better Debugging**: `wrangler tail` for live logs

## Troubleshooting

### Worker not starting locally?
- Make sure port 8787 is available
- Check `wrangler.toml` configuration
- Verify TypeScript files have no errors

### CORS errors?
- Ensure `VITE_API_BASE_URL` is correctly set in `.env`
- Check that the Worker is running

### "AI not configured" error?
- Set the `LOVABLE_API_KEY` secret: `wrangler secret put LOVABLE_API_KEY`

### "Google Maps API key not configured"?
- Set the `GOOGLE_MAPS_API_KEY` secret: `wrangler secret put GOOGLE_MAPS_API_KEY`

## Optional: Clean Up Supabase

If you no longer need Supabase, you can remove:
- `supabase/` directory
- `@supabase/supabase-js` from package.json
- `src/integrations/supabase/` directory
- Supabase environment variables

## Notes

- The `workers/tabroom-proxy.ts` file is abbreviated. You'll need to copy the remaining handler functions from the original Supabase function file if they're missing.
- Keep your API keys secure - never commit them to version control
- The Worker URL can be customized in the Cloudflare dashboard

## Support

For Cloudflare Workers documentation: https://developers.cloudflare.com/workers/
For Wrangler CLI docs: https://developers.cloudflare.com/workers/wrangler/
