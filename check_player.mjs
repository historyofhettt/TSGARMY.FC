import https from 'https';

async function fetchUrl(url, opts = {}) {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': opts.ua || 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': opts.accept || 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
      rejectUnauthorized: false,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', (e) => resolve({ error: e.message, body: '', status: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout', body: '', status: 0 }); });
    req.end();
  });
}

function extractMeta(body, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) return m[1];
  }
  return null;
}

async function run() {
  const fbUA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
  
  // Test all old slugs that should redirect
  const oldUrls = [
    '/players/tsg-vortex',   // → tsg-arjun
    '/players/tsg-ember',    // → tsg-elsaa
    '/players/tsg-luna',     // → tsg-akshii
    '/players/tsg-blaze',    // → tsg-blood
    '/players/tsg-aria',     // → tsg-kitkatt
    '/players/tsg-nova',     // → tsg-nova (now TSG NOVA owns this)
  ];
  
  console.log("=== Testing OLD player slugs (should redirect via DB) ===\n");
  for (const url of oldUrls) {
    const res = await fetchUrl(`https://tsgarmy-fc.onrender.com${url}`, { ua: fbUA });
    const ogTitle = extractMeta(res.body, 'og:title') || 'NOT FOUND';
    const ogUrl = extractMeta(res.body, 'og:url') || 'NOT FOUND';
    console.log(`${url.padEnd(30)} → Status: ${res.status}, og:title: ${ogTitle}, og:url: ${ogUrl}`);
  }
  
  // Test all new slugs
  const newUrls = [
    '/players/tsg-arjun',
    '/players/tsg-elsaa',
    '/players/tsg-akshii',
    '/players/tsg-blood',
    '/players/tsg-kitkatt',
    '/players/tsg-nova',
  ];
  
  console.log("\n=== Testing NEW player slugs ===\n");
  for (const url of newUrls) {
    const res = await fetchUrl(`https://tsgarmy-fc.onrender.com${url}`, { ua: fbUA });
    const ogTitle = extractMeta(res.body, 'og:title') || 'NOT FOUND';
    const ogUrl = extractMeta(res.body, 'og:url') || 'NOT FOUND';
    console.log(`${url.padEnd(30)} → Status: ${res.status}, og:title: ${ogTitle}`);
  }
  
  // Check image
  console.log("\n=== Image HEAD check ===\n");
  const imgRes = await fetchUrl('https://tsgarmy-fc.onrender.com/logo.png', {
    ua: fbUA,
    accept: '*/*',
    method: 'HEAD',
  });
  console.log("logo.png HEAD status:", imgRes.status);
  console.log("Content-Type:", imgRes.headers['content-type']);
  console.log("Content-Length:", imgRes.headers['content-length']);
  
  // Also check GET
  const imgGetRes = await fetchUrl('https://tsgarmy-fc.onrender.com/logo.png', {
    ua: fbUA,
    accept: '*/*',
  });
  console.log("\nlogo.png GET status:", imgGetRes.status);
  console.log("Content-Type:", imgGetRes.headers['content-type']);
  console.log("Content-Length:", imgGetRes.headers['content-length']);
}

run().catch(console.error);
