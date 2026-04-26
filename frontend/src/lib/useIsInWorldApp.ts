import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';

/**
 * True when the page is loaded inside the World App webview.
 * Returns `undefined` while MiniKit is still detecting (first render in SSR or
 * before the host injects the bridge); `false` for normal browser context.
 */
export function useIsInWorldApp(): boolean | undefined {
  const { isInstalled } = useMiniKit();
  return isInstalled;
}
