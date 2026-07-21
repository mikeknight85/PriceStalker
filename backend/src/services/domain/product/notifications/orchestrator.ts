import { 
  userRepository,
  notificationRepository,
  Product,
} from '../../../../models';
import { sendNotifications, NotificationPayload } from '../../../notifications';
import { logger } from '../../../../utils/system/logger';

export class ProductNotificationOrchestrator {
  /**
   * Orchestrates the delivery of a notification across enabled channels and logs it to the history.
   */
  async deliver(
    product: Product, 
    type: 'not_available' | 'back_in_stock' | 'price_drop' | 'target_price' | 'price_announced',
    payload: NotificationPayload,
    historyEntry: {
      type: string;
      title: string;
      message: string;
      data: any;
    }
  ) {
    try {
      const userSettings = await userRepository.getNotificationSettings(product.user_id);
      if (!userSettings) return;

      const result = await sendNotifications(userSettings, payload);
      logger.info(`Product ${product.id} | Notify | Sent ${type} alert`, 'Products', { product_id: product.id });

      if (result.channelsNotified.length > 0) {
        await notificationRepository.create({
          user_id: product.user_id,
          type: historyEntry.type as any,
          title: historyEntry.title,
          message: historyEntry.message,
          data: {
            ...historyEntry.data,
            channelsNotified: result.channelsNotified
          }
        });
      }
    } catch (err) {
      logger.error(`Product ${product.id} | Notify | Failed ${type} alert`, 'Products', { product_id: product.id, error: err });
    }
  }
}

export const productNotificationOrchestrator = new ProductNotificationOrchestrator();
