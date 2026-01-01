/**
 * Upload Document Route
 * Allows users to choose between Passport or Aadhar verification
 */

'use client';

import dynamic from 'next/dynamic';

const UploadDocumentChoice = dynamic(
  () => import('../../components/UploadDocumentChoice'),
  { ssr: false }
);

export default function UploadDocumentPage() {
  return <UploadDocumentChoice />;
}
