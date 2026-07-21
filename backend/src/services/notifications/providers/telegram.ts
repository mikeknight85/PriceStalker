import axios from 'axios';
import { NotificationProvider, NotificationPayload } from '../types';
import { logger } from '../../../utils/system/logger';
import { interpolateTemplate, formatDefaultMessage } from '../utils';

export class TelegramProvider implements NotificationProvider {
  constructor(
    private botToken: string,
    private chatId: string,
    private template?: string | null
  ) {}

  async send(payload: NotificationPayload): Promise<boolean> {
    try {
      const message = this.template 
        ? interpolateTemplate(this.template, payload) 
        : formatDefaultMessage(payload);
        
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

      await axios.post(url, {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      });

      logger.info(`Notify | Telegram | Sent to chat ${this.chatId}`, 'Notifications');
      return true;
    } catch (error) {
      logger.error(`Notify | Telegram | Failed: ${error}`, 'Notifications', error);
      return false;
    }
  }
}
