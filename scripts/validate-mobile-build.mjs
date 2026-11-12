const releaseProfiles = new Set(['preview', 'mvp1', 'production']);
if (releaseProfiles.has(process.env.EAS_BUILD_PROFILE)) {
  const raw = process.env.EXPO_PUBLIC_API_URL;
  let url;
  try { url = new URL(raw); } catch { throw new Error('Set EXPO_PUBLIC_API_URL to the deployed HTTPS Render API before building the standalone APK.'); }
  if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) {
    throw new Error('Standalone builds require a public HTTPS API URL without credentials.');
  }
}
