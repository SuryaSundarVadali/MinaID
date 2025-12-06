/**
 * API route to proxy GitHub release cache files with CORS support
 * 
 * This proxies requests from the browser to GitHub releases,
 * adding the necessary CORS headers to allow cross-origin requests.
 */

import { NextRequest, NextResponse } from 'next/server';

const GITHUB_RELEASE_BASE_URL = 'https://github.com/SuryaSundarVadali/MinaID/releases/download/cache-v1';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  const githubUrl = `${GITHUB_RELEASE_BASE_URL}/${path}`;
  
  console.log(`[Cache Proxy] Fetching: ${githubUrl}`);
  
  try {
    const response = await fetch(githubUrl, {
      headers: {
        'User-Agent': 'MinaID-Cache-Proxy/1.0',
      },
    });
    
    if (!response.ok) {
      console.error(`[Cache Proxy] GitHub returned ${response.status} for ${path}`);
      return new NextResponse(`Failed to fetch ${path}`, { 
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    
    const data = await response.arrayBuffer();
    
    // Determine content type
    const isHeader = path.endsWith('.header');
    const contentType = isHeader ? 'text/plain' : 'application/octet-stream';
    
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error(`[Cache Proxy] Error fetching ${path}:`, error);
    return new NextResponse(`Error fetching ${path}`, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
