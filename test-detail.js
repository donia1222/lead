const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  // Visit a local.ch detail page
  const url = 'https://www.local.ch/de/d/buchs-sg/9470/restaurant/the-breeze-PqlRRj87Vw1SXkOmdsd7XA';
  const res = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
  });
  const $ = cheerio.load(res.data);

  console.log('h1:', $('h1').text().trim());

  // Find website
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (href.startsWith('http') && href.indexOf('local.ch') === -1 && href.indexOf('google') === -1 && href.indexOf('facebook') === -1 && href.indexOf('instagram') === -1) {
      console.log('Website:', text.substring(0,40), '|', href);
    }
    if (href.startsWith('mailto:')) {
      console.log('Email:', href);
    }
    if (href.startsWith('tel:')) {
      console.log('Phone:', href);
    }
  });

  // Address
  $('address').each((_, el) => {
    console.log('Address:', $(el).text().trim().substring(0,100));
  });
}
test();
