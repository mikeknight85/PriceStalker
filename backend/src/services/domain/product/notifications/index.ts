import { productAlertService } from './alerts';

/**
 * Re-exporting as a unified service for backward compatibility.
 */
export const productNotificationService = productAlertService;

export * from './alerts';
export * from './orchestrator';
