import React from 'react';
import { Link } from '@tanstack/react-router';
import { ItemWithListings } from '../../../../types/api';
import { formatPrice } from '../../../../utils/format';
import Icon from '../../../../components/Icon';
import './ItemCard.css';

interface ItemCardProps {
  item: ItemWithListings;
  userLocale?: string;
}

/**
 * One item: the thing you want to buy, with the stores that sell it (#143).
 *
 * The card leads with the best price because that is the question the grouped
 * view exists to answer. Everything else on it qualifies that number -- which
 * store it came from, how many stores it was chosen between, and how many could
 * not be compared.
 */
const ItemCard: React.FC<ItemCardProps> = ({ item, userLocale }) => {
  return (
    <div className="item-card">
      <div className="item-card-head">
        {item.image_url ? (
          <img className="item-card-image" src={item.image_url} alt="" loading="lazy" />
        ) : (
          <div className="item-card-image item-card-image-empty"><Icon name="package" /></div>
        )}

        <div className="item-card-heading">
          <div className="item-card-name" title={item.name}>{item.name}</div>
          <div className="item-card-meta">
            <span className={`item-card-stock ${item.any_in_stock ? 'in' : 'out'}`}>
              {item.any_in_stock ? 'In stock' : 'Not in stock'}
            </span>
            <span className="item-card-stores">
              {item.store_count === 1 ? '1 store' : `${item.store_count} stores`}
            </span>
          </div>
        </div>

        <div className="item-card-price">
          {item.best_price !== null ? (
            <>
              <div className="item-card-price-value">
                {formatPrice(item.best_price, item.best_price_currency, userLocale)}
              </div>
              {/*
                Only claim "best" when there was actually a choice, and only
                when there is a difference. With every store at the same price,
                "best of 3" asserts a gap that does not exist (issue #161).
              */}
              {item.comparable_count > 1 && (
                <div className="item-card-price-label">
                  {item.all_tied
                    ? `same at all ${item.comparable_count}`
                    : `best of ${item.comparable_count}`}
                  {/*
                    The label stays even though every store is now highlighted:
                    the marks say which stores are cheapest, the label says there
                    is nothing to choose between them.
                  */}
                </div>
              )}
            </>
          ) : (
            <div className="item-card-price-absent">No price yet</div>
          )}
        </div>
      </div>

      {/*
        Said out loud rather than hidden: a card that silently compared 2 of 4
        stores would be claiming more than we can support. This happens when a
        store has not been scraped yet, or its currency could not be converted.
      */}
      {item.excluded_count > 0 && item.store_count > 1 && (
        <div className="item-card-note">
          <Icon name="alertTriangle" />
          {item.excluded_count === 1
            ? '1 store could not be compared, so it is not included above'
            : `${item.excluded_count} stores could not be compared, so they are not included above`}
        </div>
      )}

      {item.price_spread !== null && item.price_spread > 0 && (
        <div className="item-card-spread">
          {formatPrice(item.price_spread, item.best_price_currency, userLocale)} between the cheapest and dearest store
        </div>
      )}

      <div className="item-card-listings">
        {item.listings.map(listing => (
          <Link
            key={listing.id}
            to="/products/$productId"
            params={{ productId: String(listing.id) }}
            /*
              Every listing at the best price is marked, including when they all
              tie (issue #161).

              This first suppressed the highlight on an all-tied item, reasoning
              that marking everything says nothing. That was wrong: green means
              "this store has the lowest price", and when two stores tie both
              genuinely do. Suppressing it makes the user learn a special case,
              and asks them to notice an absence rather than read a mark.
            */
            className={`item-listing ${item.best_price_listing_ids.includes(listing.id) ? 'is-best' : ''}`}
          >
            <span className="item-listing-store">
              {listing.retailer_name || hostOf(listing.url)}
            </span>
            <span className="item-listing-price">
              {listing.converted_price !== null && listing.converted_price !== undefined
                ? formatPrice(listing.converted_price, item.best_price_currency ?? listing.currency, userLocale)
                : <span className="item-listing-absent">not compared</span>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

/** A readable store name for a listing whose retailer has no config yet. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default ItemCard;
