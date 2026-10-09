import './globals.css';

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'India Population Map — Census 2011',
  description: 'Interactive choropleth map of Census 2011 population by Indian state and district.',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0' },
  dataset: {
    '@type': 'Dataset',
    name: 'India Census 2011 district populations',
    description:
      '640 districts with population, literacy, workers, religion, households, education and age-group indicators.',
    temporalCoverage: '2011',
    spatialCoverage: 'India',
  },
};

// Runs before first paint so the saved theme applies with no flash.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('india-map-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export const metadata = {
  title: 'India Population Map — Census 2011 | State & District Choropleth',
  description:
    'Interactive choropleth map of India showing Census 2011 population by state and district, with Indian-format numbers (lakhs & crores), literacy, sex ratio and amenities.',
  keywords: [
    'India map',
    'Census 2011',
    'population by state',
    'population by district',
    'choropleth',
    'lakhs crores',
    'districts of India',
  ],
  authors: [{ name: 'Indian Population Map' }],
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    title: 'India Population Map — Census 2011',
    description:
      'Explore Census 2011 population across every Indian state and district. Zoom from India to state to district.',
    images: [{ url: '/docs/og-image.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'India Population Map — Census 2011',
    description:
      'Interactive state & district choropleth of Census 2011 population (lakhs & crores).',
    images: ['/docs/og-image.png'],
  },
};

export const viewport = {
  themeColor: '#08306b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M16 2a10 10 0 0 0-10 10c0 7.5 10 18 10 18s10-10.5 10-18A10 10 0 0 0 16 2z' fill='%232f73ae'/%3E%3Ccircle cx='16' cy='12' r='4' fill='white'/%3E%3C/svg%3E"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
