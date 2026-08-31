import { Product } from '../../../../models';
import { ScrapedProductWithVoting } from '../../../../types/scraper';
import { productNotificationOrchestrator } from './orchestrator';
import { describeUnavailableReason, type UnavailableReason } from '../../../../types/availability';

export class ProductAlertService {
  /**
   * Tells the user a product could not be reached.
   *
   * `paused` separates the two cases this used to conflate: a page that is gone
   * and no longer being checked, versus a retailer that is unreachable and still
   * being retried. Telling someone monitoring has stopped when it has not is
   * worse than saying nothing.
   */
  async notifyNotAvailable(product: Product, reason?: UnavailableReason | null, paused = true) {
    await productNotificationOrchestrator.deliver(
      product,
      'not_available',
      {
        productName: product.name || 'Unknown Product',
        productUrl: product.url,
        type: 'not_available',
        productId: product.id,
        // Both of these used to stop at the in-app history. Every external
        // channel hardcoded "Page no longer exists (404/410). Monitoring has
        // been paused", so a timeout read as a dead page, and the transient
        // path -- which does not pause -- said monitoring had stopped.
        reason: describeUnavailableReason(reason),
        paused
      },
      {
        type: 'not_available',
        // The reason and the action were hardcoded to "404/410 Page Not Found"
        // and "Monitoring Paused" regardless of what actually happened, so a
        // redirect, a soft 404 and a week-long retailer outage all read the
        // same in the notification history (issue #73).
        title: `Unavailable | ${product.name || 'Product'}`,
        message: paused
          ? `${describeUnavailableReason(reason)}. Monitoring paused.`
          : `${describeUnavailableReason(reason)}. Still retrying.`,
        data: {
          productId: product.id,
          productName: product.name,
          productUrl: product.url,
          reason: describeUnavailableReason(reason),
          reasonCode: reason ?? 'unknown_scrape_failure',
          action: paused ? 'Monitoring Paused' : 'Still Retrying'
        }
      }
    );
  }

  /**
   * Tells the user a product that had gone unavailable is reachable again.
   *
   * The issue asks for this explicitly, and without it the lifecycle only ever
   * reports bad news: a user was told monitoring had stopped and never told it
   * had started again, so a recovered product looked identical to one still
   * broken.
   */
  async notifyProductRestored(product: Product) {
    await productNotificationOrchestrator.deliver(
      product,
      'product_restored',
      {
        productName: product.name || 'Unknown Product',
        productUrl: product.url,
        type: 'product_restored',
        productId: product.id,
        oldStockStatus: product.stock_status || undefined
      },
      {
        type: 'product_restored',
        title: `Available again | ${product.name || 'Product'}`,
        message: 'The product page is reachable again. Monitoring has resumed.',
        data: {
          productId: product.id,
          productName: product.name,
          productUrl: product.url,
          reason: 'The product page is reachable again',
          action: 'Monitoring Resumed'
        }
      }
    );
  }

  /**
   * `previousStatus` is the status observed under the persistence lock, not the
   * caller's pre-scrape snapshot -- so "Previously out of stock" in the message
   * describes what actually changed rather than what the caller happened to
   * have loaded.
   */
  async notifyBackInStock(product: Product, scrapedData: ScrapedProductWithVoting, previousStatus?: string | null) {
    await productNotificationOrchestrator.deliver(
      product,
      'back_in_stock',
      {
        productName: product.name || 'Unknown Product',
        productUrl: product.url,
        type: 'back_in_stock',
        newPrice: scrapedData.price?.price,
        currency: scrapedData.price?.currency || undefined,
        oldStockStatus: previousStatus || product.stock_status || undefined,
        newStockStatus: scrapedData.stockStatus,
        productId: product.id
      },
      {
        type: 'back_in_stock',
        title: `Back in Stock: ${product.name || 'Product'}`,
        // A product can come back in stock before a price is extracted, which
        // used to render as "back in stock at undefined USD".
        message: scrapedData.price?.price !== undefined && scrapedData.price?.currency
          ? `Product is back in stock at ${scrapedData.price.currency} ${scrapedData.price.price}`
          : 'Product is back in stock. Current price: unavailable',
        data: {
          productId: product.id,
          productName: product.name,
          productUrl: product.url,
          oldStockStatus: previousStatus || product.stock_status,
          newStockStatus: scrapedData.stockStatus,
          newPrice: scrapedData.price?.price,
          currency: scrapedData.price?.currency || undefined
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
        type: 'price_announced',
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
