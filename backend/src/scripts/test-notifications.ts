import { userService } from '../services/domain/user';
import { sendTestNotification } from '../services/notifications/testing';
import { pool } from '../models';

async function main() {
  const channelArg = process.argv[2];
  const userIdArg = process.argv[3];

  const validChannels = ['telegram', 'discord', 'pushover', 'ntfy', 'gotify', 'webhook', 'email'];
  
  if (!channelArg || !validChannels.includes(channelArg.toLowerCase())) {
    console.error(`Error: Please specify a valid notification channel.`);
    console.error(`Usage: pnpm --filter pricestalker-backend exec tsx src/scripts/test-notifications.ts <channel> [userId]`);
    console.error(`Available channels: ${validChannels.join(', ')}`);
    process.exit(1);
  }

  const channel = channelArg.toLowerCase() as any;
  const userId = userIdArg ? parseInt(userIdArg, 10) : 1;

  console.log(`Sending Test Notification to channel: '${channel}' for User ID: ${userId}`);
  console.log('===========================================================');

  try {
    const settings = await userService.getNotificationSettings(userId);
    if (!settings) {
      console.error(`Error: User with ID ${userId} not found or has no notification settings.`);
      await pool.end();
      process.exit(1);
    }

    console.log('Loaded Settings fields for verification:');
    const fieldsToPrint: Record<string, any> = {};
    Object.keys(settings).forEach(key => {
      const val = (settings as any)[key];
      if (key.includes(channel) || key.startsWith('email') || key.startsWith('smtp') || key.startsWith('webhook')) {
        if (key.includes('token') || key.includes('password') || key.includes('key')) {
          fieldsToPrint[key] = val ? '********' : null;
        } else {
          fieldsToPrint[key] = val;
        }
      }
    });
    console.log(JSON.stringify(fieldsToPrint, null, 2));
    console.log('Sending...');

    const success = await sendTestNotification(channel, settings as any);

    console.log('\n====================================');
    if (success) {
      console.log(`✅ SUCCESS: Test notification sent successfully to '${channel}'.`);
    } else {
      console.log(`❌ FAILURE: Failed to send test notification to '${channel}'.`);
      console.log('Make sure the required fields for this channel are configured in the database/admin settings.');
    }
    console.log('====================================');
  } catch (err) {
    console.error('Execution failed with error:', err);
  } finally {
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
});
