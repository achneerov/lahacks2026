import type { CSSProperties, ReactNode } from 'react';
import Sidebar from '../components/Sidebar';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell" style={styles.shell}>
      <Sidebar />
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    textAlign: 'left',
    minHeight: 0,
  },
  main: {
    flex: 1,
    minWidth: 0,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  },
};
