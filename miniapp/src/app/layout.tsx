import ClientProviders from '@/providers';
import '@worldcoin/mini-apps-ui-kit-react/styles.css';
import type { Metadata } from 'next';
import './globals.css';
import '@/desktop/index.css';

export const metadata: Metadata = {
  title: 'Impulse',
  description: 'Hire with World ID-verified humans.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
