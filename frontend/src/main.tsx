import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider'
import './index.css'
import App from './App.tsx'

const worldAppId = import.meta.env.VITE_WORLD_ID_APP_ID as `app_${string}` | undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MiniKitProvider props={worldAppId ? { appId: worldAppId } : undefined}>
      <App />
    </MiniKitProvider>
  </StrictMode>,
)
