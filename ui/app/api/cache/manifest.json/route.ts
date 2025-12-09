/**
 * Cache manifest API route
 * Returns a list of all available cache files
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const cacheDir = path.join(process.cwd(), 'public', 'cache');
    
    // Read all files in cache directory
    const files = await fs.readdir(cacheDir);
    
    // Filter out directories and special files
    const cacheFiles = files.filter(file => 
      file !== '.gitkeep' && 
      file !== 'README.md' &&
      !file.startsWith('.')
    );

    // Get file sizes
    const filesWithMeta = await Promise.all(
      cacheFiles.map(async (file) => {
        const filePath = path.join(cacheDir, file);
        const stats = await fs.stat(filePath);
        return {
          path: file,
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      })
    );

    return NextResponse.json({
      files: cacheFiles,
      filesWithMeta,
      totalSize: filesWithMeta.reduce((sum, f) => sum + f.size, 0),
      count: cacheFiles.length,
      generated: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('[Cache Manifest] Error:', error);
    return NextResponse.json(
      { error: 'Failed to read cache directory' },
      { status: 500 }
    );
  }
}
