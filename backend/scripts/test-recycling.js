const axios = require('axios');

const TOKEN = process.env.ADMIN_TOKEN || 'placeholder-token';
const URLS = [
  'https://www.coles.com.au/product/cadbury-favourites-boxed-chocolate-265g-1115573',
  'https://www.harveynorman.com.au/jbl-boombox-4-portable-bluetooth-speaker.html',
  'https://www.bunnings.com.au/coleman-2-4m-ultra-compact-portable-gazebo_p0185612',
  'https://httpbin.org/headers'
];

async function run() {
  const host = process.env.API_URL || 'http://localhost:3001';
  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    const ua = `Test-Agent-Recycle-${i}`;
    console.log(`\n[Test ${i+1}] Scraping ${url} with UA: ${ua}`);
    try {
      const res = await axios.post(`${host}/api/admin/debug/extract`, {
        url,
        config: { user_agent: ua, use_browser_scraper: true }
      }, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      console.log(`[Success] Price: ${res.data.price?.price}, Name: ${res.data.name}`);
    } catch (e) {
      console.error(`[Error]`, e.response?.data || e.message);
    }
  }
}

run();