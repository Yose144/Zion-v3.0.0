import { NextRequest, NextResponse } from 'next/server';
import { getMiningPoolsConfig } from '@/lib/network-config';

/**
 * Best Pool API
 * 
 * Returns the best mining pool based on user's geographic location.
 * Defaults to the current public Zion2 host and supports env overrides.
 */

const POOLS = getMiningPoolsConfig();

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lon = parseFloat(searchParams.get('lon') || '0');

  if (lat === 0 && lon === 0) {
    // No location provided, return configured pools with the primary pool first.
    const allPools = POOLS.map(p => ({
      ...p,
      stratumUrl: `stratum+tcp://${p.host}:${p.port}`,
    }));
    const defaultRecommended = allPools[0];
    return NextResponse.json({
      pools: allPools,
      recommended: defaultRecommended ?? null,
      message: 'Provide lat and lon query params for location-based recommendation'
    });
  }

  // Calculate distances and sort
  const poolsWithDistance = POOLS.map(pool => ({
    ...pool,
    distance: haversineDistance(lat, lon, pool.lat, pool.lon),
    stratumUrl: `stratum+tcp://${pool.host}:${pool.port}`,
  })).sort((a, b) => a.distance - b.distance);

  const recommended = poolsWithDistance[0];

  return NextResponse.json({
    userLocation: { lat, lon },
    recommended: {
      ...recommended,
      estimatedLatency: Math.round(recommended.distance / 100), // rough ms estimate
    },
    pools: poolsWithDistance,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
    }
  });
}
