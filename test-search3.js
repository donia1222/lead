const axios = require('axios');
const cheerio = require('cheerio');

async function testDuckDuckGo() {
  console.log('=== DuckDuckGo ===');
  const url = 'https://html.duckduckgo.com/html/?q=restaurant+Buchs+SG+website';
  const res = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
  const $ = cheerio.load(res.data);

  $('.result').each((i, el) => {
    const title = $(el).find('.result__title a').text().trim();
    const href = $(el).find('.result__title a').attr('href') || '';
    const snippet = $(el).find('.result__snippet').text().trim();
    if (title && href.includes('http')) {
      console.log(i, title.substring(0,60));
      console.log('  URL:', href.substring(0,80));
      console.log('  Desc:', snippet.substring(0,80));
      console.log('---');
    }
  });
}

async function testLocalCh() {
  console.log('\n=== local.ch ===');
  const url = 'https://www.local.ch/de/q/Buchs%20SG/restaurant';
  const res = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
  const $ = cheerio.load(res.data);

  console.log('HTML length:', res.data.length);
  // Try to find listing items
  const selectors = ['article', '.result', '.listing', '[data-cy]', 'h2', 'h3', '.entry-title'];
  selectors.forEach(s => {
    const count = $(s).length;
    if (count > 0) console.log(s + ':', count);
  });

  $('a').each((i, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (text.length > 5 && text.length < 60 && href.includes('/d/') && i < 30) {
      console.log('Entry:', text, '|', href.substring(0, 80));
    }
  });
}

testDuckDuckGo().then(testLocalCh);
