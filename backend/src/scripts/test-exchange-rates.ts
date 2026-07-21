import { currencyConversionService } from '../services/domain/system/CurrencyConversionService';
import { exchangeRateRepository } from '../models';
import { pool } from '../models';

async function main() {
  const shouldUpdate = process.argv.includes('--update');
  
  if (shouldUpdate) {
    console.log('Fetching latest exchange rates from external API and updating database...');
    try {
      await currencyConversionService.updateRates();
      console.log('Rates updated successfully.');
    } catch (err: any) {
      console.error('Failed to update rates:', err.message);
    }
    await pool.end();
    return;
  }

  const fromArg = process.argv[2] || 'AUD';
  const toArg = process.argv[3] || 'USD';
  const amountArg = process.argv[4] || '100';

  const from = fromArg.toUpperCase();
  const to = toArg.toUpperCase();
  const amount = parseFloat(amountArg);

  if (isNaN(amount)) {
    console.error('Error: Amount must be a valid number.');
    console.error('Usage: npx tsx src/scripts/test-exchange-rates.ts [from] [to] [amount]');
    console.error('Usage (update DB rates): npx tsx src/scripts/test-exchange-rates.ts --update');
    process.exit(1);
  }

  console.log(`Testing Currency Conversion: ${amount} ${from} ➔ ${to}`);
  console.log('===========================================================');

  try {
    // 1. Check direct rate from database
    const directRate = await exchangeRateRepository.getRate(from, to);
    console.log(`- Direct rate in database (${from} ➔ ${to}): ${directRate !== null ? directRate : 'None'}`);

    // 2. Perform conversion
    const converted = await currencyConversionService.convert(amount, from, to);
    
    console.log('\n====================================');
    if (converted !== null) {
      console.log(`✅ Converted Amount: ${amount} ${from} = ${converted} ${to}`);
    } else {
      console.log(`❌ FAILURE: Conversion failed. No exchange rate is defined between ${from} and ${to}.`);
      console.log('Run with --update to fetch active rates: npx tsx src/scripts/test-exchange-rates.ts --update');
    }
    console.log('====================================');
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
