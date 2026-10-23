import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MediScan AI — Medicine Scanner',
  description: 'Scan any medicine → Get info in Hindi & English with audio • दवा स्कैन करें, जानकारी पाएं',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MediScan AI',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#09130F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function() { console.log('MediScan AI SW registered'); })
                    .catch(function(err) { console.log('SW registration failed: ', err); });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}