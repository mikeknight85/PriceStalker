import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { settingsCache } from '../utils/cache';
import { pool } from '../models';

async function main() {
  const testUrl = process.argv[2] || 'https://httpbin.org/ip';
  console.log(`--- PriceGhost Scraper Proxy & UA Tester ---`);
  console.log(`Target Test URL: ${testUrl}`);

  try {
    const proxy = await settingsCache.getScraperProxy();
    console.log(`Configured Proxy: ${proxy || 'None (No proxy is configured in database)'}`);
    console.log('===========================================================');

    // 1. Direct request (No Proxy)
    console.log('\n1. Executing direct request (no proxy)...');
    try {
      const resDirect = await axios.get(testUrl, { timeout: 15000 });
      console.log('✅ Success!');
      console.log('Response Status:', resDirect.status);
      console.log('Response Data:', JSON.stringify(resDirect.data));
    } catch (err: any) {
      console.error('❌ Direct request failed:', err.message);
    }

    // 2. Request using Proxy (if configured)
    if (proxy) {
      console.log(`\n2. Executing request through proxy: ${proxy}...`);
      try {
        const agent = new HttpsProxyAgent(proxy);
        const resProxy = await axios.get(testUrl, {
          httpsAgent: agent,
          timeout: 20000,
        });
        console.log('✅ Success!');
        console.log('Response Status:', resProxy.status);
        console.log('Response Data:', JSON.stringify(resProxy.data));
      } catch (err: any) {
        console.error('❌ Proxy request failed:', err.message);
        console.error('Please verify your proxy settings, network routing, or credentials.');
      }
    } else {
      console.log('\n[Skipping Proxy Test]: No proxy is configured in system settings.');
    }
  } catch (err) {
    console.error('Execution failed:', err);
  } finally {
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
});
