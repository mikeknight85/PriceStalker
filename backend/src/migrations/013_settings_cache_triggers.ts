import { MigrationContext } from '../config/migrate';

export const up = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query(`
    CREATE OR REPLACE FUNCTION notify_settings_change()
    RETURNS trigger AS $$
    BEGIN
      PERFORM pg_notify('settings_change', TG_TABLE_NAME);
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_settings_change ON system_settings;
    CREATE TRIGGER trigger_settings_change
    AFTER INSERT OR UPDATE OR DELETE ON system_settings
    FOR EACH STATEMENT EXECUTE FUNCTION notify_settings_change();

    DROP TRIGGER IF EXISTS trigger_retailer_change ON retailer_configs;
    CREATE TRIGGER trigger_retailer_change
    AFTER INSERT OR UPDATE OR DELETE ON retailer_configs
    FOR EACH STATEMENT EXECUTE FUNCTION notify_settings_change();
  `);
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  await pool.query(`
    DROP TRIGGER IF EXISTS trigger_settings_change ON system_settings;
    DROP TRIGGER IF EXISTS trigger_retailer_change ON retailer_configs;
    DROP FUNCTION IF EXISTS notify_settings_change();
  `);
};
