export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=1200');

  // Fast, lightweight JSON response (avoids downloading index.html)
  return res.status(200).json({
    version: '2.5.0',
    buildId: 'v2.5.0-opt',
    buildTime: new Date().toISOString(),
    status: 'healthy'
  });
}
