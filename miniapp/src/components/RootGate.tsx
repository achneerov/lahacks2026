'use client';
import dynamic from 'next/dynamic';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';

const DesktopApp = dynamic(() => import('@/desktop/App'), {
  ssr: false,
  loading: () => <div style={{ padding: 32 }}>Loading…</div>,
});

const MiniApp = dynamic(() => import('@/miniapp/MiniApp'), {
  ssr: false,
  loading: () => <div style={{ padding: 32 }}>Loading…</div>,
});

/**
 * Top-level gate that picks the correct UI based on whether we're inside the
 * World App. `useMiniKit().isInstalled` is `true` when MiniKit detected the
 * `window.WorldApp` bridge, `false` once detection has completed in a normal
 * browser, and `null`/`undefined` while the provider is still initializing.
 */
export default function RootGate() {
  const { isInstalled } = useMiniKit();

  if (isInstalled === true) return <MiniApp />;
  if (isInstalled === false) return <DesktopApp />;
  return <div style={{ padding: 32 }}>Loading…</div>;
}
