// app/api/ipfs/test-connection/route.ts - Test Pinata credentials
import { NextRequest, NextResponse } from 'next/server';
import pinataSDK from '@pinata/sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, apiSecret } = body;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'API key and secret required' },
        { status: 400 }
      );
    }

    // Test Pinata connection
    const pinata = new pinataSDK(apiKey, apiSecret);
    await pinata.testAuthentication();

    return NextResponse.json({
      success: true,
      message: 'Pinata credentials are valid'
    });
  } catch (error: any) {
    console.error('[Pinata Test] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Invalid credentials' },
      { status: 401 }
    );
  }
}
