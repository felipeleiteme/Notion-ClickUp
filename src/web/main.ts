import { injectSpeedInsights } from '@vercel/speed-insights';

// Run inside the browser to enable Vercel Speed Insights for the static landing page.
if (typeof window !== 'undefined') {
  injectSpeedInsights();
}
