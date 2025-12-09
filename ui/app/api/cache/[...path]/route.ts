/**
 * API route to serve ZK circuit cache files from /public/cache
 * 
 * This serves cache files from the local public directory,
 * allowing BrowserCache to fetch from /api/cache/<filename>
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const relativePath = params.path.join('/');
    
    // In production the Next.js app's CWD is the ui/ directory,
    // so public/ is at <cwd>/public.
    const filePath = path.join(process.cwd(), 'public', 'cache', relativePath);
    
    console.log(`[Cache API] Serving: ${relativePath}`);
    
    const data = await fs.readFile(filePath);
    
    // Determine content type
    const ext = path.extname(filePath);
    let contentType = 'application/octet-stream';
    
    if (ext === '.json') contentType = 'application/json';
    if (ext === '.header') contentType = 'application/octet-stream';
    
    // Convert Buffer to Uint8Array for NextResponse
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('[Cache API] Failed to serve file', {
      error: error?.message,
      params: params.path,
    });
    
    return new NextResponse('Cache file not found', { 
      status: 404,
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
