import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MediScan AI — Medicine Scanner',
    short_name: 'MediScan AI',
    description: 'Scan any medicine → Get info in Hindi & English • दवा स्कैन करें, जानकारी पाएं',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}