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
    type: 'not_available' | 'product_restored' | 'back_in_stock' | 'price_drop' | 'target_price' | 'price_announced',
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

      // The in-app history records what happened to the product, not whether a
      // message left the building (issue #92). It used to be written only when
      // at least one external channel succeeded, which meant:
      //
      //   - a user with no channels configured -- the state every install
      //     starts in -- got no notification history at all, and
      //   - when every channel failed, the one record that would have explained
      //     the silence was the record that was skipped.
      //
      // The delivery outcome is kept alongside it, both channels and failures,
      // so "the alert fired but Telegram was down" stays distinguishable from
      // "the alert never fired".
      await notificationRepository.create({
        user_id: product.user_id,
        type: historyEntry.type as any,
        title: historyEntry.title,
        message: historyEntry.message,
        data: {
          ...historyEntry.data,
          channelsNotified: result.channelsNotified,
          channelsFailed: result.channelsFailed
        }
      });

      if (result.channelsFailed.length > 0) {
        logger.warn(
          `Product ${product.id} | Notify | ${type} alert recorded; delivery failed on ${result.channelsFailed.join(', ')}`,
          'Products',
          { product_id: product.id }
        );
      } else {
        logger.info(
          `Product ${product.id} | Notify | Sent ${type} alert to ${result.channelsNotified.join(', ') || 'no external channels'}`,
          'Products',
          { product_id: product.id }
        );
      }
    } catch (err) {
      logger.error(`Product ${product.id} | Notify | Failed ${type} alert`, 'Products', { product_id: product.id, error: err });
    }
  }
}

export const productNotificationOrchestrator = new ProductNotificationOrchestrator();
