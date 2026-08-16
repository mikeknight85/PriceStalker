const axios = require('axios');

const TOKEN = process.env.ADMIN_TOKEN || 'placeholder-token';
const TESTS = [
  { url: 'https://www.coles.com.au/product/cadbury-favourites-boxed-chocolate-265g-1115573', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' },
  { url: 'https://www.harveynorman.com.au/jbl-boombox-4-portable-bluetooth-speaker.html', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15' },
  { url: 'https://www.bunnings.com.au/coleman-2-4m-ultra-compact-portable-gazebo_p0185612', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0' }
];

async function run() {
  const host = process.env.API_URL || 'http://localhost:3001';
  for (let i = 0; i < TESTS.length; i++) {
    const { url, ua } = TESTS[i];
    console.log(`\n[Test ${i+1}] Scraping ${new URL(url).hostname} with Realistic UA...`);
    try {
      const res = await axios.post(`${host}/api/admin/debug/extract`, {
        url,
        config: { user_agent: ua, use_browser_scraper: true }
      }, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      console.log(`[Success] Price: ${res.data.price?.price || 'Not Found'}, Name: ${res.data.name || res.data.retailerName}`);
    } catch (e) {
      console.error(`[Error]`, e.response?.data || e.message);
    }
  }
}

run();