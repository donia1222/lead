const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const url = 'https://tel.search.ch/?was=restaurant+Buchs+SG';
  const res = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const $ = cheerio.load(res.data);

  $('.tel-resultentry').each((i, el) => {
    const name = $(el).find('h2 a').first().text().trim();
    const detailLink = $(el).find('h2 a').first().attr('href') || '';
    const address = $(el).find('address').text().trim();
    const phone = $(el).find('a[href^="tel:"]').first().attr('href') || '';

    const websites = [];
    $(el).find('a').each((_, a) => {
      const href = $(a).attr('href') || '';
      if (href.startsWith('http') && href.indexOf('search.ch') === -1 && href.indexOf('local.ch') === -1) {
        websites.push(href);
      }
    });

    console.log(i, '|', name);
    console.log('  Address:', address.substring(0,60));
    console.log('  Phone:', phone);
    console.log('  Websites:', websites);
    if (detailLink) console.log('  Detail:', 'https://tel.search.ch' + detailLink);
    console.log('---');
  });
}
test();
