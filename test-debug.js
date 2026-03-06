const axios = require('axios');
const cheerio = require('cheerio');

async function debug() {
  const url = 'https://www.local.ch/de/q/Werdenberg/zahnarzt';
  console.log('Fetching:', url);

  const res = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  const $ = cheerio.load(res.data);
  console.log('HTML length:', res.data.length);

  // Check all link patterns
  console.log('\n--- All href patterns with /d/ ---');
  const dLinks = [];
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('/d/')) {
      dLinks.push(href);
    }
  });
  console.log('Links with /d/:', dLinks.length);
  dLinks.slice(0, 10).forEach(l => console.log('  ', l.substring(0, 100)));

  // Check all links
  console.log('\n--- All unique href prefixes ---');
  const prefixes = new Set();
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.length > 1) {
      const prefix = href.substring(0, 30);
      prefixes.add(prefix);
    }
  });
  [...prefixes].slice(0, 30).forEach(p => console.log('  ', p));

  // Check if content is in JSON/script tags
  console.log('\n--- Script tags with data ---');
  $('script').each((_, el) => {
    const text = $(el).html() || '';
    if (text.includes('zahnarzt') || text.includes('Zahnarzt') || text.includes('dentist')) {
      console.log('Found script with zahnarzt data, length:', text.length);
      // Find URLs in the script
      const urls = text.match(/https?:\/\/[^\s"'<>]+/g) || [];
      const bizUrls = urls.filter(u => !u.includes('local.ch') && !u.includes('google') && (u.includes('.ch') || u.includes('.li')));
      console.log('Business URLs in script:', bizUrls.length);
      bizUrls.slice(0, 10).forEach(u => console.log('  ', u.substring(0, 100)));

      // Find names
      const nameMatches = text.match(/"name"\s*:\s*"([^"]+)"/g) || [];
      nameMatches.slice(0, 10).forEach(n => console.log('  Name:', n));
    }
  });

  // Check for __NEXT_DATA__ or similar
  console.log('\n--- Check for framework data ---');
  $('script[id="__NEXT_DATA__"]').each((_, el) => {
    console.log('Found __NEXT_DATA__, length:', ($(el).html() || '').length);
  });

  // Check for any JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html() || '';
    console.log('Found JSON-LD, length:', text.length);
    if (text.includes('zahnarzt') || text.includes('Zahnarzt')) {
      console.log('  Contains zahnarzt data');
    }
  });

  // Raw search for business names in HTML
  console.log('\n--- Raw text search ---');
  const htmlLower = res.data.toLowerCase();
  if (htmlLower.includes('zahnarzt')) console.log('HTML contains "zahnarzt"');
  if (htmlLower.includes('dental')) console.log('HTML contains "dental"');
  if (htmlLower.includes('praxis')) console.log('HTML contains "praxis"');

  // Find all href="/de/d/ patterns
  const deD = res.data.match(/href="\/de\/d\/[^"]+"/g) || [];
  console.log('\nhref="/de/d/..." matches:', deD.length);
  deD.slice(0, 10).forEach(m => console.log('  ', m.substring(0, 100)));

  // Maybe they use /d/ without /de/
  const justD = res.data.match(/href="\/d\/[^"]+"/g) || [];
  console.log('\nhref="/d/..." matches:', justD.length);
  justD.slice(0, 10).forEach(m => console.log('  ', m.substring(0, 100)));

  // Try another URL format
  console.log('\n\n=== TRYING ALTERNATIVE URL ===');
  const url2 = 'https://www.local.ch/de/q/Buchs%20SG/zahnarzt';
  console.log('Fetching:', url2);
  const res2 = await axios.get(url2, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
  const $2 = cheerio.load(res2.data);
  console.log('HTML length:', res2.data.length);

  const deD2 = res2.data.match(/href="\/de\/d\/[^"]+"/g) || [];
  console.log('href="/de/d/..." matches:', deD2.length);
  deD2.slice(0, 5).forEach(m => console.log('  ', m.substring(0, 100)));

  // Check for JSON data in scripts
  $2('script').each((_, el) => {
    const text = $(el).html() || '';
    if (text.includes('zahnarzt') || text.includes('Zahnarzt') || text.includes('/de/d/')) {
      console.log('Script with relevant data, length:', text.length);
      const urls = text.match(/\/de\/d\/[^"'\s]+/g) || [];
      urls.slice(0, 5).forEach(u => console.log('  Path:', u));
    }
  });
}

debug().catch(e => console.error('Error:', e.message));
