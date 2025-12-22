// app/api/ipfs/upload/route.ts - Server-side IPFS upload endpoint
import { NextRequest, NextResponse } from 'next/server';
import pinataSDK from '@pinata/sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, metadata, name, credentials } = body;

    // Use user credentials if provided, otherwise use environment variables
    let apiKey = credentials?.apiKey || process.env.NEXT_PUBLIC_PINATA_API_KEY;
    let apiSecret = credentials?.apiSecret || process.env.NEXT_PUBLIC_PINATA_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Pinata credentials not configured. Please connect your Pinata account in Settings.' },
        { status: 500 }
      );
    }

    const pinata = new pinataSDK(apiKey, apiSecret);

    // Upload to IPFS
    const pinataMetadata = {
      name: name || `data-${Date.now()}`,
      keyvalues: {
        encrypted: 'true',
        timestamp: Date.now().toString(),
        ...metadata,
      },
    };

    const result = await pinata.pinJSONToIPFS(data, {
      pinataMetadata,
    });

    return NextResponse.json({
      cid: result.IpfsHash,
      ipfsHash: result.IpfsHash,
      size: result.PinSize,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[IPFS Upload API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
