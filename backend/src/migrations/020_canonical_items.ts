import { MigrationContext } from '../config/migrate';

/**
 * Introduces the canonical item -- the thing you want to buy, as opposed to one
 * retailer's listing of it (issue #143).
 *
 * The v1 schema already anticipated this and the v2 rewrite never built on it:
 * `product_groups`, `products.group_id` and `products.is_primary` all exist,
 * fully constrained, with zero rows and zero code references. So this is
 * finishing an unfinished data model rather than inventing one.
 *
 * ## Naming
 *
 * `product_groups` becomes `items`. "Group" implies different physical things
 * sold together -- a keyboard and a mouse -- whereas these are the *same* thing
 * sold by different merchants. The UI will say "Product" for an item and
 * "Store" for a listing, because that is how people think; the database says
 * `items` and `products` because those are unambiguous to read. That split is
 * deliberate and is recorded in CLAUDE.md.
 *
 * ## Every product gets an item
 *
 * A product sold at one retailer is an item with one listing. The alternative
 * -- creating items only when a user links two URLs -- means `item_id` is
 * sometimes null, and then alert settings have to live on both tables with a
 * rule about which wins. One code path is worth one migration.
 *
 * ## Alert settings move up
 *
 * `target_price`, `price_drop_threshold` and `notify_back_in_stock` describe
 * intent about the thing you want ("tell me when anyone has this under 50"),
 * not about one shop's page. They are copied onto the item here.
 *
 * The columns on `products` are deliberately **left in place**. Migrations run
 * one-way at boot with no rollback, so dropping a column in the same release
 * that stops reading it leaves nothing to fall back on if the new path is
 * wrong. A later migration drops them once this has run in beta.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. product_groups -> items, and its sequence and constraints with it.
    //    Postgres keeps constraint names across a table rename, and
    //    `product_groups_pkey` on a table called `items` is a trap for whoever
    //    reads it next.
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_groups')
           AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='items') THEN
          ALTER TABLE public.product_groups RENAME TO items;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_class WHERE relkind='S' AND relname='product_groups_id_seq') THEN
          ALTER SEQUENCE public.product_groups_id_seq RENAME TO items_id_seq;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_groups_pkey') THEN
          ALTER TABLE public.items RENAME CONSTRAINT product_groups_pkey TO items_pkey;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_groups_user_id_fkey') THEN
          ALTER TABLE public.items RENAME CONSTRAINT product_groups_user_id_fkey TO items_user_id_fkey;
        END IF;
      END $$;
    `);

    // 2. products.group_id -> products.item_id.
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='group_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='item_id') THEN
          ALTER TABLE public.products RENAME COLUMN group_id TO item_id;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_group_id_fkey') THEN
          ALTER TABLE public.products RENAME CONSTRAINT products_group_id_fkey TO products_item_id_fkey;
        END IF;
      END $$;
    `);

    // 3. Alert settings on the item.
    await client.query(`
      ALTER TABLE public.items ADD COLUMN IF NOT EXISTS target_price numeric(10,2);
      ALTER TABLE public.items ADD COLUMN IF NOT EXISTS price_drop_threshold numeric(10,2);
      ALTER TABLE public.items ADD COLUMN IF NOT EXISTS notify_back_in_stock boolean DEFAULT false;
    `);

    // 4. One item per product that does not have one.
    //
    //    A temporary column carries the link, because INSERT ... RETURNING
    //    cannot map generated ids back to the rows that produced them.
    //    Products with no user_id are skipped: items.user_id is NOT NULL with a
    //    foreign key, and an ownerless product is already orphaned.
    await client.query(`ALTER TABLE public.items ADD COLUMN IF NOT EXISTS migration_source_product_id integer`);

    await client.query(`
      INSERT INTO public.items (name, category, image_url, user_id, target_price, price_drop_threshold, notify_back_in_stock, migration_source_product_id)
      SELECT
        LEFT(COALESCE(NULLIF(TRIM(p.name), ''), p.url), 255),
        p.category,
        p.image_url,
        p.user_id,
        p.target_price,
        p.price_drop_threshold,
        COALESCE(p.notify_back_in_stock, false),
        p.id
      FROM public.products p
      WHERE p.item_id IS NULL AND p.user_id IS NOT NULL
    `);

    const linked = await client.query(`
      UPDATE public.products p
      SET item_id = i.id, is_primary = true
      FROM public.items i
      WHERE i.migration_source_product_id = p.id AND p.item_id IS NULL
    `);

    await client.query(`ALTER TABLE public.items DROP COLUMN IF EXISTS migration_source_product_id`);

    // 5. Indexes. Fetching every listing for an item is the single most common
    //    query this feature adds, and there was no index on the column.
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_item_id ON public.products (item_id)`);

    //    At most one primary listing per item. Without this the "which listing
    //    supplies the name and image" question has no single answer, and the
    //    bug only shows up as a display flicker much later.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS products_one_primary_per_item
      ON public.products (item_id) WHERE is_primary
    `);

    if (linked.rowCount) {
      console.log(`[020] Created ${linked.rowCount} item(s), one per existing product, and carried their alert settings up.`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Reverses the renames, and removes only the items this migration created.
 *
 * The alert columns on `products` were never dropped, so nothing needs copying
 * back -- they still hold what they held. Items with exactly one listing are
 * the ones created here; an item a user has since attached a second store to is
 * left alone rather than silently discarded.
 */
export const down = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`DROP INDEX IF EXISTS products_one_primary_per_item`);
    await client.query(`DROP INDEX IF EXISTS idx_products_item_id`);

    await client.query(`
      UPDATE public.products SET item_id = NULL, is_primary = false
      WHERE item_id IN (SELECT item_id FROM public.products WHERE item_id IS NOT NULL GROUP BY item_id HAVING count(*) = 1)
    `);
    await client.query(`DELETE FROM public.items i WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.item_id = i.id)`);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='item_id') THEN
          ALTER TABLE public.products RENAME COLUMN item_id TO group_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='items') THEN
          ALTER TABLE public.items RENAME TO product_groups;
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
