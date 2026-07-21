import { Product } from '../../../../models';
import { ScrapedProductWithVoting } from '../../../../types/scraper';
import { productNotificationOrchestrator } from './orchestrator';

export class ProductAlertService {
  async notifyNotAvailable(product: Product) {
    await productNotificationOrchestrator.deliver(
      product,
      'not_available',
      {
        productName: product.name || 'Unknown Product',
        productUrl: product.url,
        type: 'not_available',
        productId: product.id
      },
      {
        type: 'system_alert',
        title: `404 | ${product.name || 'Product'}`,
        message: 'Page not found. Monitoring paused.',
        data: {
          productId: product.id,
          productName: product.name,
          productUrl: product.url,
          reason: '404/410 Page Not Found',
          action: 'Monitoring Paused'
        }
      }
    );
  }

  async notifyBackInStock(product: Product, scrapedData: ScrapedProductWithVoting) {
    await productNotificationOrchestrator.deliver(
      product,
      'back_in_stock',
      {
        productName: product.name || 'Unknown Product',
        productUrl: product.url,
        type: 'back_in_stock',
        newPrice: scrapedData.price?.price,
        currency: scrapedData.price?.currency || 'USD',
        productId: product.id
      },
      {
        type: 'stock_alert',
        title: `Back in Stock: ${product.name || 'Product'}`,
        message: `Product is back in stock at ${scrapedData.price?.price} ${scrapedData.price?.currency || 'USD'}`,
        data: {
          productId: product.id,
          productName: product.name,
          productUrl: product.url,
          oldStockStatus: product.stock_status,
          newStockStatus: scrapedData.stockStatus,
          newPrice: scrapedData.price?.price,
          currency: scrapedData.price?.currency || 'USD'
        }
      }
    );
  }

  async notifyPriceDrop(product: Product, oldPrice: number, newPriceObj: { price: number; currency: string }) {
    const priceDrop = oldPrice - newPriceObj.price;
    if (priceDrop < (product.price_drop_threshold || 0)) return;

    const priceChangePercent = ((oldPrice - newPriceObj.price) / oldPrice) * 100;

    await productNotificationOrchestrator.deliver(
      product,
      'price_drop',
      {
        productName: product.name || 'Unknown Product',
        productUrl: product.url,
        type: 'price_drop',
        oldPrice: oldPrice,
        newPrice: newPriceObj.price,
        currency: newPriceObj.currency,
        threshold: product.price_drop_threshold!,
        productId: product.id
      },
      {
        type: 'price_drop',
        title: `Price Drop: ${product.name || 'Product'}`,
        message: `Price dropped from ${oldPrice} to ${newPriceObj.price} ${newPriceObj.currency}`,
        data: {
          productId: product.id,
          productName: product.name,
          productUrl: product.url,
          oldPrice: oldPrice,
          newPrice: newPriceObj.price,
          currency: newPriceObj.currency,
          priceChangePercent: Math.round(priceChangePercent * 100) / 100
        }
      }
    );
  }

  async notifyTargetHit(product: Product, oldPrice: number | null, newPriceObj: { price: number; currency: string }) {
    const targetPrice = parseFloat(String(product.target_price));
    if (newPriceObj.price > targetPrice || (oldPrice !== null && oldPrice <= targetPrice)) return;

    await productNotificationOrchestrator.deliver(
      product,
      'target_price',
      {
        productName: product.name || 'Unknown Product',
        productUrl: product.url,
        type: 'target_price',
        newPrice: newPriceObj.price,
        currency: newPriceObj.currency,
        targetPrice: targetPrice,
        productId: product.id
      },
      {
        type: 'target_price',
        title: `Target Reached: ${product.name || 'Product'}`,
        message: `Price reached your target of ${targetPrice} (Current: ${newPriceObj.price} ${newPriceObj.currency})`,
        data: {
          productId: product.id,
          productName: product.name,
          productUrl: product.url,
          oldPrice: oldPrice || undefined,
          newPrice: newPriceObj.price,
          currency: newPriceObj.currency,
          targetPrice: targetPrice
        }
      }
    );
  }

  async notifyPriceAnnounced(product: Product, newPriceObj: { price: number; currency: string }) {
    await productNotificationOrchestrator.deliver(
      product,
      'price_announced',
      {
        productName: product.name || 'Unknown Product',
        productUrl: product.url,
        type: 'price_announced',
        newPrice: newPriceObj.price,
        currency: newPriceObj.currency,
        productId: product.id
      },
      {
        type: 'price_alert',
        title: `Price Announced: ${product.name || 'Product'}`,
        message: `Price has been announced for this pre-order item: ${newPriceObj.price} ${newPriceObj.currency}`,
        data: {
          productId: product.id,
          productName: product.name,
          productUrl: product.url,
          newPrice: newPriceObj.price,
          currency: newPriceObj.currency
        }
      }
    );
  }
}

export const productAlertService = new ProductAlertService();
