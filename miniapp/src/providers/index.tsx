'use client';
import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const ErudaProvider = dynamic(
  () => import('@/providers/Eruda').then((c) => c.ErudaProvider),
  { ssr: false },
);

interface ClientProvidersProps {
  children: ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ErudaProvider>
      <MiniKitProvider>{children}</MiniKitProvider>
    </ErudaProvider>
  );
}
