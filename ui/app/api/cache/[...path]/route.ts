/**
 * API route to serve ZK circuit cache files
 * 
 * Tries to serve from local /public/cache first,
 * Falls back to external cache URL (GitHub Releases) if not found locally.
 * This allows development with local cache while production uses external hosting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// External cache URL (from environment variable or default to GitHub Releases)
const EXTERNAL_CACHE_URL = process.env.CACHE_URL || 
  'https://github.com/SuryaSundarVadali/MinaID/releases/download/v1.0.0-cache';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const relativePath = params.path.join('/');
  
  // Try local file first (for development)
  try {
    const filePath = path.join(process.cwd(), 'public', 'cache', relativePath);
    console.log(`[Cache API] Trying local: ${relativePath}`);
    
    const data = await fs.readFile(filePath);
    
    // Determine content type
    const ext = path.extname(filePath);
    let contentType = 'application/octet-stream';
    
    if (ext === '.json') contentType = 'application/json';
    if (ext === '.header') contentType = 'application/octet-stream';
    
    console.log(`[Cache API] ✅ Served from local: ${relativePath}`);
    
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'X-Cache-Source': 'local',
      },
    });
  } catch (localError: any) {
    // Local file not found, try external cache
    console.log(`[Cache API] Local file not found, trying external: ${relativePath}`);
    
    try {
      const externalUrl = `${EXTERNAL_CACHE_URL}/${relativePath}`;
      console.log(`[Cache API] Fetching from: ${externalUrl}`);
      
      const response = await fetch(externalUrl, {
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`External cache returned ${response.status}`);
      }
      
      const data = await response.arrayBuffer();
      
      // Determine content type
      const ext = path.extname(relativePath);
      let contentType = 'application/octet-stream';
      
      if (ext === '.json') contentType = 'application/json';
      if (ext === '.header') contentType = 'application/octet-stream';
      
      console.log(`[Cache API] ✅ Served from external: ${relativePath} (${data.byteLength} bytes)`);
      
      return new NextResponse(new Uint8Array(data), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'X-Cache-Source': 'external',
        },
      });
    } catch (externalError: any) {
      console.error('[Cache API] ❌ Failed to fetch from both local and external', {
        file: relativePath,
        localError: localError?.message,
        externalError: externalError?.message,
        externalUrl: EXTERNAL_CACHE_URL,
      });
      
      return new NextResponse(
        JSON.stringify({
          error: 'Cache file not found',
          file: relativePath,
          localError: localError?.message,
          externalError: externalError?.message,
          externalUrl: EXTERNAL_CACHE_URL,
          hint: 'Set CACHE_URL environment variable to point to external cache hosting',
        }), 
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
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
