const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  // Try detail page approach - get links from search, visit each
  const url = 'https://tel.search.ch/?was=restaurant+Buchs+SG';
  const res = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);

  // Find all detail links
  const detailLinks = [];
  $('a[href*="/tel/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (href.startsWith('/tel/') && href.split('/').length > 3 && text.length > 2) {
      const full = 'https://tel.search.ch' + href;
      if (detailLinks.indexOf(full) === -1) {
        detailLinks.push(full);
        console.log('Found:', text, '|', full);
      }
    }
  });

  // Visit first detail page
  if (detailLinks.length > 0) {
    console.log('\n--- Visiting detail page ---');
    const detail = await axios.get(detailLinks[0], { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = cheerio.load(detail.data);

    console.log('Title:', d('h1').text().trim());
    console.log('Address:', d('address').text().trim());

    // Find all links
    d('a').each((i, el) => {
      const href = d(el).attr('href') || '';
      const text = d(el).text().trim();
      if (href.startsWith('http') && href.indexOf('search.ch') === -1 && href.indexOf('local.ch') === -1 && href.indexOf('google') === -1) {
        console.log('Link:', text.substring(0, 40), '|', href);
      }
      if (href.startsWith('tel:')) {
        console.log('Phone:', href);
      }
      if (href.startsWith('mailto:')) {
        console.log('Email:', href);
      }
    });
  }
}
test();
