'use client';

import { useEffect, useState } from 'react';

export default function TestCacheAPI() {
  const [results, setResults] = useState<Array<{file: string, status: number, size?: number, error?: string}>>([]);
  const [testing, setTesting] = useState(false);

  const testFiles = [
    'lagrange-basis-fp-1024',
    'lagrange-basis-fp-1024.header',
    'srs-fp-65536',
    'srs-fp-65536.header',
    'step-pk-zkpverifier-verifyageproof',
    'step-pk-zkpverifier-verifyageproof.header',
  ];

  const testCacheAccess = async () => {
    setTesting(true);
    setResults([]);

    for (const file of testFiles) {
      try {
        const response = await fetch(`/api/cache/${file}`);
        const result: any = {
          file,
          status: response.status,
        };

        if (response.ok) {
          const blob = await response.blob();
          result.size = blob.size;
        } else {
          result.error = await response.text();
        }

        setResults(prev => [...prev, result]);
      } catch (error: any) {
        setResults(prev => [...prev, {
          file,
          status: 0,
          error: error.message
        }]);
      }
    }

    setTesting(false);
  };

  useEffect(() => {
    testCacheAccess();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Cache API Test</h1>
      
      <button
        onClick={testCacheAccess}
        disabled={testing}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 mb-6"
      >
        {testing ? 'Testing...' : 'Test Cache Access'}
      </button>

      <div className="space-y-4">
        {results.map((result, i) => (
          <div 
            key={i}
            className={`p-4 rounded border ${
              result.status === 200 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="font-mono text-sm">
              <div><strong>File:</strong> {result.file}</div>
              <div><strong>Status:</strong> {result.status}</div>
              {result.size && <div><strong>Size:</strong> {(result.size / 1024 / 1024).toFixed(2)} MB</div>}
              {result.error && <div className="text-red-600"><strong>Error:</strong> {result.error}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h2 className="font-bold mb-2">Expected Results</h2>
        <p className="text-sm text-gray-700">
          All files should return status 200 with their file sizes.
          If you see 404 errors, the cache files are not being deployed to production.
        </p>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded">
        <h2 className="font-bold mb-2">Cache URL</h2>
        <p className="text-sm font-mono break-all">
          {typeof window !== 'undefined' ? window.location.origin : 'N/A'}/api/cache/
        </p>
      </div>
    </div>
  );
}
