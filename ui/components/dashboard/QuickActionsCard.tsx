/**
 * QuickActionsCard.tsx
 * 
 * Quick action buttons for common tasks
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface QuickActionsCardProps {
  onGenerateProof?: () => void;
  isLoading?: boolean;
}

export function QuickActionsCard({ onGenerateProof, isLoading = false }: QuickActionsCardProps) {
  const router = useRouter();

  const actions = [
    {
      icon: '📄',
      label: 'Upload Aadhar XML',
      description: 'Add your credential document',
      color: 'blue',
      onClick: () => {
        console.log('Navigating to /upload-aadhar');
        router.push('/upload-aadhar');
      },
    },
    {
      icon: '🏛️',
      label: 'Citizenship Proof',
      description: 'Generate citizenship proof',
      color: 'indigo',
      onClick: () => {
        console.log('Navigating to /did-proof for citizenship');
        router.push('/did-proof?type=citizenship');
      },
    },
    {
      icon: '🎂',
      label: 'Age 18+ Proof',
      description: 'Verify you are 18 or older',
      color: 'green',
      onClick: () => {
        console.log('Navigating to /did-proof for age 18+');
        router.push('/did-proof?type=age18');
      },
    },
    {
      icon: '🍺',
      label: 'Age 21+ Proof',
      description: 'Verify you are 21 or older',
      color: 'purple',
      onClick: () => {
        console.log('Navigating to /did-proof for age 21+');
        router.push('/did-proof?type=age21');
      },
    },
    {
      icon: '✅',
      label: 'Verify Proof',
      description: 'Verify submitted proofs',
      color: 'emerald',
      onClick: () => {
        console.log('Navigating to /verifier');
        router.push('/verifier');
      },
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Quick Actions</h2>
      
      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            disabled={isLoading}
            className={`flex items-center space-x-3 sm:space-x-4 p-3 sm:p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]
              ${action.color === 'blue' ? 'border-blue-200 hover:border-blue-400 hover:bg-blue-50' : ''}
              ${action.color === 'indigo' ? 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50' : ''}
              ${action.color === 'green' ? 'border-green-200 hover:border-green-400 hover:bg-green-50' : ''}
              ${action.color === 'purple' ? 'border-purple-200 hover:border-purple-400 hover:bg-purple-50' : ''}
              ${action.color === 'emerald' ? 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50' : ''}
              ${action.color === 'gray' ? 'border-gray-200 hover:border-gray-400 hover:bg-gray-50' : ''}
            `}
          >
            <div className="text-2xl sm:text-3xl flex-shrink-0">{action.icon}</div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{action.label}</p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">{action.description}</p>
            </div>
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        ))}
      </div>

      {/* Info Box */}
      <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs sm:text-sm text-blue-800">
          <span className="font-semibold">💡 Tip:</span> Generate proofs to share
          verifiable claims without revealing your actual data.
        </p>
      </div>
    </div>
  );
}
