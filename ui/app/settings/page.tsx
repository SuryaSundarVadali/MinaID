/**
 * settings/page.tsx
 * 
 * Settings page with account management and deletion
 */

'use client';

import React from 'react';
import { SettingsDashboard } from '../../components/SettingsDashboard';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsDashboard />
    </ProtectedRoute>
  );
}
