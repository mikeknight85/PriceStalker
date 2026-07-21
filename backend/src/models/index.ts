import pool from '../config/database';

// Centralized types
export * from './types';

// Repositories
export { userRepository as userQueries, userRepository } from '../services/domain/user/repositories/user.repository';
export { notificationRepository as notificationQueries, notificationRepository } from '../services/domain/notification/repositories/notification.repository';
export { systemSettingsRepository as systemSettingsQueries, systemSettingsRepository } from '../services/domain/system/repositories/system-settings.repository';
export { systemLogRepository as logQueries, systemLogRepository } from '../services/domain/system/repositories/system-log.repository';
export { 
  regionalCurrencyRepository as regionalCurrencyQueries, regionalCurrencyRepository,
  globalCurrencyRepository as globalCurrencyQueries, globalCurrencyRepository,
  exchangeRateRepository as exchangeRateQueries, exchangeRateRepository
} from '../services/domain/system/repositories/currency.repository';
export { productRepository as productQueries, productRepository } from '../services/domain/product/repositories/product.repository';
export { priceHistoryRepository as priceHistoryQueries, priceHistoryRepository } from '../services/domain/product/repositories/price-history.repository';
export { stockHistoryRepository as stockStatusHistoryQueries, stockHistoryRepository } from '../services/domain/product/repositories/stock-history.repository';
import { retailerQueryRepository as rQueries } from '../services/domain/retailer/repositories/retailer-query.repository';
import { retailerMutationRepository as rMutations } from '../services/domain/retailer/repositories/retailer-mutation.repository';
export const retailerRepository = {
  ...rQueries,
  ...rMutations
};
export const retailerQueries = retailerRepository;

export { systemApiTokenRepository as systemApiTokenQueries, systemApiTokenRepository } from '../services/domain/token/repositories/system_api_token.repository';
export { authConfigRepository, authConfigRepository as authConfigQueries } from '../services/domain/auth/repositories/auth-config.repository';

export { pool };
