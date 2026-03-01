// Nearby Places handler for Cloudflare Workers
import type { Env } from './index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const TYPE_MAP: Record<string, string[]> = {
  food: ['restaurant', 'meal_delivery', 'meal_takeaway', 'bakery'],
  cafe: ['cafe', 'coffee_shop'],
  store: ['convenience_store', 'pharmacy', 'book_store', 'supermarket'],
};

const ICON_MAP: Record<string, string> = {
  restaurant: '🍽️',
  meal_delivery: '🍕',
  meal_takeaway: '🥡',
  bakery: '🥐',
  cafe: '☕',
  coffee_shop: '☕',
  convenience_store: '🏪',
  pharmacy: '💊',
  book_store: '📚',
  supermarket: '🛒',
};

export async function handleNearbyPlaces(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const API_KEY = env.GOOGLE_MAPS_API_KEY;
  if (!API_KEY) {
    return json({ error: 'Google Maps API key not configured' }, 500);
  }

  try {
    const body = await request.json() as {
      lat: number;
      lng: number;
      filter?: string;
      radius?: number;
    };
    const { lat, lng, filter = 'all', radius = 800 } = body;

    if (!lat || !lng) {
      return json({ error: 'lat and lng are required' }, 400);
    }

    // Determine which types to search
    let includedTypes: string[] = [];
    if (filter === 'all') {
      includedTypes = Object.values(TYPE_MAP).flat();
    } else if (TYPE_MAP[filter]) {
      includedTypes = TYPE_MAP[filter];
    } else {
      includedTypes = [filter];
    }

    // Use Google Places API (New) - Nearby Search
    const placesRes = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask':
            'places.displayName,places.types,places.rating,places.userRatingCount,places.currentOpeningHours,places.shortFormattedAddress,places.location,places.primaryType',
        },
        body: JSON.stringify({
          includedTypes,
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius,
            },
          },
          rankPreference: 'DISTANCE',
        }),
      }
    );

    const placesData = await placesRes.json() as any;

    if (!placesRes.ok) {
      console.error('Places API error:', JSON.stringify(placesData));
      return json({ error: 'Places API error', details: placesData }, placesRes.status);
    }

    const places = (placesData.places || []).map((p: any) => {
      const primaryType = p.primaryType || (p.types?.[0]) || '';
      const matchedCategory = Object.entries(TYPE_MAP).find(([_, types]) =>
        types.some((t) => p.types?.includes(t))
      );

      // Calculate distance from user
      const dLat = (p.location.latitude - lat) * 111320;
      const dLng = (p.location.longitude - lng) * 111320 * Math.cos(lat * Math.PI / 180);
      const distMeters = Math.sqrt(dLat * dLat + dLng * dLng);
      const distMin = Math.max(1, Math.round(distMeters / 80)); // ~80m per minute walking

      // Opening hours
      let hoursText = '';
      if (p.currentOpeningHours?.openNow !== undefined) {
        hoursText = p.currentOpeningHours.openNow ? 'Open now' : 'Closed';
      }

      // Build meta string
      const parts: string[] = [];
      if (primaryType) parts.push(primaryType.replace(/_/g, ' '));
      if (p.rating) parts.push(`⭐ ${p.rating}`);
      if (p.userRatingCount) parts.push(`(${p.userRatingCount})`);
      if (hoursText) parts.push(hoursText);

      return {
        name: p.displayName?.text || 'Unknown',
        icon: ICON_MAP[primaryType] || '📍',
        meta: parts.join(' · '),
        dist: `${distMin} min`,
        distMeters: Math.round(distMeters),
        type: matchedCategory?.[0] || 'other',
        rating: p.rating || null,
        address: p.shortFormattedAddress || '',
        lat: p.location.latitude,
        lng: p.location.longitude,
        isOpen: p.currentOpeningHours?.openNow ?? null,
      };
    });

    // Sort by distance
    places.sort((a: any, b: any) => a.distMeters - b.distMeters);

    return json({ places, total: places.length });
  } catch (e) {
    console.error('Nearby places error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
}
