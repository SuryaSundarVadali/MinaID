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
      icon: '🔐',
      label: 'Generate Proof',
      description: 'Create zero-knowledge proof',
      color: 'indigo',
      onClick: onGenerateProof,
    },
    {
      icon: '📤',
      label: 'Upload Credential',
      description: 'Add new credential',
      color: 'green',
      onClick: () => router.push('/signup?step=2'),
    },
    {
      icon: '🔗',
      label: 'Link Wallet',
      description: 'Connect another wallet',
      color: 'purple',
      onClick: () => alert('Link wallet feature coming soon!'),
    },
    {
      icon: '⚙️',
      label: 'Settings',
      description: 'Manage your account',
      color: 'gray',
      onClick: () => router.push('/settings'),
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
      
      <div className="grid grid-cols-1 gap-3">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            disabled={isLoading}
            className={`flex items-center space-x-4 p-4 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md
              ${action.color === 'indigo' ? 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50' : ''}
              ${action.color === 'green' ? 'border-green-200 hover:border-green-400 hover:bg-green-50' : ''}
              ${action.color === 'purple' ? 'border-purple-200 hover:border-purple-400 hover:bg-purple-50' : ''}
              ${action.color === 'gray' ? 'border-gray-200 hover:border-gray-400 hover:bg-gray-50' : ''}
            `}
          >
            <div className="text-3xl">{action.icon}</div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-gray-900">{action.label}</p>
              <p className="text-sm text-gray-500">{action.description}</p>
            </div>
            <svg
              className="w-5 h-5 text-gray-400"
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
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">💡 Tip:</span> Generate proofs to share
          verifiable claims without revealing your actual data.
        </p>
      </div>
    </div>
  );
}
