import { MigrationContext } from '../config/migrate';

/**
 * Clears the email template nobody chose (issue #92).
 *
 * The settings form prefilled both email template fields with a price-drop
 * sentence:
 *
 *   Subject: PriceStalker Alert: {{product_name}}
 *   Body:    Hi,
 *
 *            {{product_name}} has dropped to {{current_price}}!
 *
 *            View it here: {{product_url}}
 *
 * A user who opened Notification Channels to set up any *other* channel and
 * pressed Save stored that template without ever intending to write one. A
 * configured template wins over the per-event defaults -- correctly, it is the
 * user's choice -- so from then on every alert claimed a price drop, including
 * a product coming back in stock and a product going missing.
 *
 * Only the exact prefilled string is cleared. Anything the user typed, edited,
 * or even changed the whitespace of is theirs and is left alone. Cleared to
 * NULL, the backend picks wording that matches each event.
 *
 * Idempotent: re-running matches nothing, because the rows it would match have
 * already been set to NULL.
 */

const PREFILLED_SUBJECT = 'PriceStalker Alert: {{product_name}}';
const PREFILLED_BODY = 'Hi,\n\n{{product_name}} has dropped to {{current_price}}!\n\nView it here: {{product_url}}';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // The two fields are cleared independently: a user may well have rewritten
    // the body while leaving the prefilled subject in place.
    const subject = await client.query(
      `UPDATE users SET email_subject_template = NULL WHERE email_subject_template = $1`,
      [PREFILLED_SUBJECT]
    );
    const body = await client.query(
      `UPDATE users SET email_body_template = NULL WHERE email_body_template = $1`,
      [PREFILLED_BODY]
    );

    if (subject.rowCount || body.rowCount) {
      console.log(
        `[018] Cleared prefilled email templates: ${subject.rowCount} subject, ${body.rowCount} body. ` +
        `These users now get wording that matches each event.`
      );
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
 * Intentionally does nothing.
 *
 * Restoring the template would mean writing it back for users who never chose
 * it, and there is no record of which NULLs were cleared by this migration
 * versus which were already NULL. Reversing it would put the wrong wording back
 * on more accounts than it took it off.
 */
export const down = async () => {
  // No-op. See above.
};
