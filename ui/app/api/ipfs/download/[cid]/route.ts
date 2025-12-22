// app/api/ipfs/download/[cid]/route.ts - Server-side IPFS download endpoint
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { cid: string } }
) {
  try {
    const cid = params.cid;
    
    if (!cid) {
      return NextResponse.json(
        { error: 'CID is required' },
        { status: 400 }
      );
    }

    const gatewayUrl = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud';
    const url = `${gatewayUrl}/ipfs/${cid}`;

    // Fetch from IPFS gateway
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch from IPFS: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      data,
      cid,
    });
  } catch (error: any) {
    console.error('[IPFS Download API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Download failed' },
      { status: 500 }
    );
  }
}
