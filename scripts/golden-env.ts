// Pinned so Date-derived day bucketing (toDateString) is reproducible across machines.
process.env.TZ = 'America/Chicago';
// Must be the FIRST import of network golden generation: services read these at module load.
process.env.EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL = 'https://proxy.test/token';
delete process.env.EXPO_PUBLIC_USDA_API_KEY;   // → 'DEMO_KEY', same default the Swift tests use
