import { MigrationContext } from '../config/migrate';

/**
 * Squashed baseline schema.
 *
 * GENERATED FILE -- do not edit by hand.
 * Regenerate with database/v2-migration/generate-baseline.py.
 *
 * Replaces migrations 001-022, which no longer replay from an empty database:
 * 012 and 020 reference retailer_configs.original_price_selectors, which nothing
 * before them creates, and 010 cannot re-run against the schema in
 * database/init.sql. That dump was the only working bootstrap, and it stamped
 * nothing into the `migrations` table.
 *
 * Every statement here is idempotent, so this converges to the same schema from
 * any starting point: an empty database, a database bootstrapped from init.sql,
 * or a PriceStalker v1 database that has been through 000_v1_compat.
 */
export const up = async ({ context: pool }: { context: MigrationContext }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- sequences ---------------------------------------------------------
    await client.query(`
CREATE SEQUENCE IF NOT EXISTS public.exchange_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.global_currencies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.price_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.product_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.regional_currency_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.retailer_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.stock_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.system_api_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.system_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.user_memberships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
`);

    // --- tables ------------------------------------------------------------
    await client.query(`
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id integer NOT NULL,
    from_currency character varying(10) NOT NULL,
    to_currency character varying(10) NOT NULL,
    rate numeric(20,10) NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.global_currencies (
    id integer NOT NULL,
    country_territory text,
    currency_name text,
    iso character varying(10) NOT NULL,
    symbol text,
    locale character varying(10) NOT NULL,
    separation character varying(10),
    "position" character varying(10)
);
CREATE TABLE IF NOT EXISTS public.migrations (
    name character varying(255) NOT NULL
);
CREATE TABLE IF NOT EXISTS public.notifications (
    id integer NOT NULL,
    user_id integer,
    type character varying(50) NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.price_history (
    id integer NOT NULL,
    product_id integer,
    price numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::character varying,
    recorded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ai_status character varying(20),
    price_type character varying(20) DEFAULT 'standard'::character varying,
    details jsonb
);
CREATE TABLE IF NOT EXISTS public.product_groups (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(255),
    image_url text,
    user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.products (
    id integer NOT NULL,
    user_id integer,
    url text NOT NULL,
    name text,
    image_url text,
    refresh_interval integer DEFAULT 43200,
    last_checked timestamp without time zone,
    next_check_at timestamp without time zone,
    stock_status character varying(20) DEFAULT 'unknown'::character varying,
    price_drop_threshold numeric(10,2),
    target_price numeric(10,2),
    notify_back_in_stock boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    preferred_extraction_method character varying(20),
    needs_price_review boolean DEFAULT false,
    price_candidates jsonb,
    anchor_price numeric(10,2),
    ai_verification_disabled boolean DEFAULT false,
    ai_extraction_disabled boolean DEFAULT false,
    checking_paused boolean DEFAULT false,
    ai_status character varying(20),
    category text,
    price_type character varying(20) DEFAULT 'standard'::character varying,
    group_id integer,
    is_primary boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.regional_currency_mappings (
    id integer NOT NULL,
    pattern character varying(50) NOT NULL,
    currency character varying(10) NOT NULL,
    match_type character varying(20) NOT NULL,
    active boolean DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.retailer_configs (
    id integer NOT NULL,
    domain character varying(255) NOT NULL,
    use_proxy boolean DEFAULT false,
    use_browser boolean DEFAULT false,
    is_js_heavy boolean DEFAULT false,
    currency_hint character varying(10),
    name_selectors jsonb DEFAULT '[]'::jsonb,
    price_selectors jsonb DEFAULT '[]'::jsonb,
    image_selectors jsonb DEFAULT '[]'::jsonb,
    stock_selectors jsonb DEFAULT '[]'::jsonb,
    in_stock_phrases jsonb DEFAULT '[]'::jsonb,
    out_of_stock_phrases jsonb DEFAULT '[]'::jsonb,
    pre_order_phrases jsonb DEFAULT '[]'::jsonb,
    custom_selectors jsonb DEFAULT '{}'::jsonb,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_agent text,
    description text,
    member_only_phrases jsonb DEFAULT '[]'::jsonb,
    name text,
    status character varying(50) DEFAULT 'OK'::character varying,
    use_remote_scraper boolean DEFAULT false,
    deal_price_selectors jsonb DEFAULT '[]'::jsonb,
    member_price_selectors jsonb DEFAULT '[]'::jsonb,
    pre_order_price_selectors jsonb DEFAULT '[]'::jsonb,
    retailer_name_selectors jsonb DEFAULT '[]'::jsonb,
    referrer text,
    status_history jsonb DEFAULT '[]'::jsonb,
    jsonld_image_key text,
    jsonld_price_key text,
    jsonld_name_key text,
    original_price_selectors jsonb DEFAULT '[]'::jsonb,
    skip_denoising boolean DEFAULT false,
    ai_selectors jsonb,
    exclusion_selectors jsonb DEFAULT '[]'::jsonb NOT NULL,
    selector_metadata jsonb DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS public.site_configs (
    domain character varying(255) NOT NULL,
    use_browser boolean DEFAULT false,
    price_selectors text[],
    name_selectors text[],
    image_selectors text[],
    stock_selectors text[],
    default_currency character varying(10) DEFAULT 'AUD'::character varying,
    is_enabled boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.stock_status_history (
    id integer NOT NULL,
    product_id integer,
    status character varying(20) NOT NULL,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.system_api_tokens (
    id integer NOT NULL,
    admin_id integer,
    token_hash character varying(255) NOT NULL,
    label character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    last_used_at timestamp without time zone
);
CREATE TABLE IF NOT EXISTS public.system_logs (
    id integer NOT NULL,
    level character varying(20) NOT NULL,
    context character varying(50),
    message text NOT NULL,
    details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.system_settings (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.user_memberships (
    id integer NOT NULL,
    user_id integer NOT NULL,
    retailer_domain text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255),
    is_admin boolean DEFAULT false,
    telegram_bot_token character varying(255),
    telegram_chat_id character varying(255),
    discord_webhook_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    pushover_user_key text,
    pushover_app_token text,
    telegram_enabled boolean DEFAULT true,
    discord_enabled boolean DEFAULT true,
    pushover_enabled boolean DEFAULT true,
    ntfy_topic text,
    ntfy_server_url text,
    ntfy_username text,
    ntfy_password text,
    ntfy_enabled boolean DEFAULT true,
    gotify_url text,
    gotify_app_token text,
    gotify_enabled boolean DEFAULT true,
    email_enabled boolean DEFAULT false,
    smtp_host text,
    smtp_port integer DEFAULT 587,
    email_from text,
    email_to text,
    email_subject_template text,
    email_body_template text,
    webhook_url text,
    webhook_headers text,
    webhook_payload_template text,
    webhook_enabled boolean DEFAULT false,
    telegram_message_template text,
    discord_message_template text,
    pushover_message_template text,
    ntfy_message_template text,
    gotify_message_template text,
    currency character varying(10) DEFAULT 'AUD'::character varying,
    locale character varying(10) DEFAULT 'en-AU'::character varying,
    preferred_currency character varying(10) DEFAULT 'AUD'::character varying,
    categories jsonb DEFAULT '[]'::jsonb,
    disabled boolean DEFAULT false
);
`);

    // --- columns (converges tables that already existed but were short) -----
    await client.query(`
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS from_currency character varying(10);
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS to_currency character varying(10);
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS rate numeric(20,10);
ALTER TABLE public.exchange_rates ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.global_currencies ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.global_currencies ADD COLUMN IF NOT EXISTS country_territory text;
ALTER TABLE public.global_currencies ADD COLUMN IF NOT EXISTS currency_name text;
ALTER TABLE public.global_currencies ADD COLUMN IF NOT EXISTS iso character varying(10);
ALTER TABLE public.global_currencies ADD COLUMN IF NOT EXISTS symbol text;
ALTER TABLE public.global_currencies ADD COLUMN IF NOT EXISTS locale character varying(10);
ALTER TABLE public.global_currencies ADD COLUMN IF NOT EXISTS separation character varying(10);
ALTER TABLE public.global_currencies ADD COLUMN IF NOT EXISTS position character varying(10);
ALTER TABLE public.migrations ADD COLUMN IF NOT EXISTS name character varying(255);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id integer;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type character varying(50);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.price_history ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.price_history ADD COLUMN IF NOT EXISTS product_id integer;
ALTER TABLE public.price_history ADD COLUMN IF NOT EXISTS price numeric(10,2);
ALTER TABLE public.price_history ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD'::character varying;
ALTER TABLE public.price_history ADD COLUMN IF NOT EXISTS recorded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.price_history ADD COLUMN IF NOT EXISTS ai_status character varying(20);
ALTER TABLE public.price_history ADD COLUMN IF NOT EXISTS price_type character varying(20) DEFAULT 'standard'::character varying;
ALTER TABLE public.price_history ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE public.product_groups ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.product_groups ADD COLUMN IF NOT EXISTS name character varying(255);
ALTER TABLE public.product_groups ADD COLUMN IF NOT EXISTS category character varying(255);
ALTER TABLE public.product_groups ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.product_groups ADD COLUMN IF NOT EXISTS user_id integer;
ALTER TABLE public.product_groups ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.product_groups ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS refresh_interval integer DEFAULT 43200;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_checked timestamp without time zone;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS next_check_at timestamp without time zone;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_status character varying(20) DEFAULT 'unknown'::character varying;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_drop_threshold numeric(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS target_price numeric(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS notify_back_in_stock boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS preferred_extraction_method character varying(20);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS needs_price_review boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_candidates jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS anchor_price numeric(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ai_verification_disabled boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ai_extraction_disabled boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS checking_paused boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ai_status character varying(20);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_type character varying(20) DEFAULT 'standard'::character varying;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS group_id integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;
ALTER TABLE public.regional_currency_mappings ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.regional_currency_mappings ADD COLUMN IF NOT EXISTS pattern character varying(50);
ALTER TABLE public.regional_currency_mappings ADD COLUMN IF NOT EXISTS currency character varying(10);
ALTER TABLE public.regional_currency_mappings ADD COLUMN IF NOT EXISTS match_type character varying(20);
ALTER TABLE public.regional_currency_mappings ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS domain character varying(255);
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS use_proxy boolean DEFAULT false;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS use_browser boolean DEFAULT false;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS is_js_heavy boolean DEFAULT false;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS currency_hint character varying(10);
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS name_selectors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS price_selectors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS image_selectors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS stock_selectors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS in_stock_phrases jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS out_of_stock_phrases jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS pre_order_phrases jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS custom_selectors jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS member_only_phrases jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS status character varying(50) DEFAULT 'OK'::character varying;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS use_remote_scraper boolean DEFAULT false;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS deal_price_selectors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS member_price_selectors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS pre_order_price_selectors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS retailer_name_selectors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS referrer text;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS status_history jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS jsonld_image_key text;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS jsonld_price_key text;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS jsonld_name_key text;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS original_price_selectors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS skip_denoising boolean DEFAULT false;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS ai_selectors jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS exclusion_selectors jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailer_configs ADD COLUMN IF NOT EXISTS selector_metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.site_configs ADD COLUMN IF NOT EXISTS domain character varying(255);
ALTER TABLE public.site_configs ADD COLUMN IF NOT EXISTS use_browser boolean DEFAULT false;
ALTER TABLE public.site_configs ADD COLUMN IF NOT EXISTS price_selectors text[];
ALTER TABLE public.site_configs ADD COLUMN IF NOT EXISTS name_selectors text[];
ALTER TABLE public.site_configs ADD COLUMN IF NOT EXISTS image_selectors text[];
ALTER TABLE public.site_configs ADD COLUMN IF NOT EXISTS stock_selectors text[];
ALTER TABLE public.site_configs ADD COLUMN IF NOT EXISTS default_currency character varying(10) DEFAULT 'AUD'::character varying;
ALTER TABLE public.site_configs ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT true;
ALTER TABLE public.site_configs ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.stock_status_history ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.stock_status_history ADD COLUMN IF NOT EXISTS product_id integer;
ALTER TABLE public.stock_status_history ADD COLUMN IF NOT EXISTS status character varying(20);
ALTER TABLE public.stock_status_history ADD COLUMN IF NOT EXISTS changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.system_api_tokens ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.system_api_tokens ADD COLUMN IF NOT EXISTS admin_id integer;
ALTER TABLE public.system_api_tokens ADD COLUMN IF NOT EXISTS token_hash character varying(255);
ALTER TABLE public.system_api_tokens ADD COLUMN IF NOT EXISTS label character varying(100);
ALTER TABLE public.system_api_tokens ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.system_api_tokens ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.system_api_tokens ADD COLUMN IF NOT EXISTS expires_at timestamp without time zone;
ALTER TABLE public.system_api_tokens ADD COLUMN IF NOT EXISTS last_used_at timestamp without time zone;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS level character varying(20);
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS context character varying(50);
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS details jsonb;
ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS key character varying(255);
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS value text;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.user_memberships ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.user_memberships ADD COLUMN IF NOT EXISTS user_id integer;
ALTER TABLE public.user_memberships ADD COLUMN IF NOT EXISTS retailer_domain text;
ALTER TABLE public.user_memberships ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id integer;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email character varying(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash character varying(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name character varying(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telegram_bot_token character varying(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telegram_chat_id character varying(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS discord_webhook_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pushover_user_key text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pushover_app_token text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telegram_enabled boolean DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS discord_enabled boolean DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pushover_enabled boolean DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ntfy_topic text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ntfy_server_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ntfy_username text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ntfy_password text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ntfy_enabled boolean DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gotify_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gotify_app_token text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gotify_enabled boolean DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_enabled boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS smtp_host text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS smtp_port integer DEFAULT 587;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_from text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_to text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_subject_template text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_body_template text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS webhook_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS webhook_headers text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS webhook_payload_template text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS webhook_enabled boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telegram_message_template text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS discord_message_template text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pushover_message_template text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ntfy_message_template text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gotify_message_template text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS currency character varying(10) DEFAULT 'AUD'::character varying;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locale character varying(10) DEFAULT 'en-AU'::character varying;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_currency character varying(10) DEFAULT 'AUD'::character varying;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS disabled boolean DEFAULT false;
`);

    // --- sequence ownership (needs the tables to exist) ---------------------
    await client.query(`
ALTER SEQUENCE public.exchange_rates_id_seq OWNED BY public.exchange_rates.id;
ALTER SEQUENCE public.global_currencies_id_seq OWNED BY public.global_currencies.id;
ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;
ALTER SEQUENCE public.price_history_id_seq OWNED BY public.price_history.id;
ALTER SEQUENCE public.product_groups_id_seq OWNED BY public.product_groups.id;
ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;
ALTER SEQUENCE public.regional_currency_mappings_id_seq OWNED BY public.regional_currency_mappings.id;
ALTER SEQUENCE public.retailer_configs_id_seq OWNED BY public.retailer_configs.id;
ALTER SEQUENCE public.stock_status_history_id_seq OWNED BY public.stock_status_history.id;
ALTER SEQUENCE public.system_api_tokens_id_seq OWNED BY public.system_api_tokens.id;
ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;
ALTER SEQUENCE public.user_memberships_id_seq OWNED BY public.user_memberships.id;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
`);

    // --- column defaults ---------------------------------------------------
    await client.query(`
ALTER TABLE ONLY public.exchange_rates ALTER COLUMN id SET DEFAULT nextval('public.exchange_rates_id_seq'::regclass);
ALTER TABLE ONLY public.global_currencies ALTER COLUMN id SET DEFAULT nextval('public.global_currencies_id_seq'::regclass);
ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);
ALTER TABLE ONLY public.price_history ALTER COLUMN id SET DEFAULT nextval('public.price_history_id_seq'::regclass);
ALTER TABLE ONLY public.product_groups ALTER COLUMN id SET DEFAULT nextval('public.product_groups_id_seq'::regclass);
ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);
ALTER TABLE ONLY public.regional_currency_mappings ALTER COLUMN id SET DEFAULT nextval('public.regional_currency_mappings_id_seq'::regclass);
ALTER TABLE ONLY public.retailer_configs ALTER COLUMN id SET DEFAULT nextval('public.retailer_configs_id_seq'::regclass);
ALTER TABLE ONLY public.stock_status_history ALTER COLUMN id SET DEFAULT nextval('public.stock_status_history_id_seq'::regclass);
ALTER TABLE ONLY public.system_api_tokens ALTER COLUMN id SET DEFAULT nextval('public.system_api_tokens_id_seq'::regclass);
ALTER TABLE ONLY public.system_logs ALTER COLUMN id SET DEFAULT nextval('public.system_logs_id_seq'::regclass);
ALTER TABLE ONLY public.user_memberships ALTER COLUMN id SET DEFAULT nextval('public.user_memberships_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
`);

    // --- constraints -------------------------------------------------------
    await client.query(`
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exchange_rates_from_currency_to_currency_key') THEN
    ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_from_currency_to_currency_key UNIQUE (from_currency, to_currency);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exchange_rates_pkey') THEN
    ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'global_currencies_pkey') THEN
    ALTER TABLE ONLY public.global_currencies
    ADD CONSTRAINT global_currencies_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'migrations_pkey') THEN
    ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (name);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_pkey') THEN
    ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_history_pkey') THEN
    ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_groups_pkey') THEN
    ALTER TABLE ONLY public.product_groups
    ADD CONSTRAINT product_groups_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_pkey') THEN
    ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_user_id_url_key') THEN
    ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_url_key UNIQUE (user_id, url);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regional_currency_mappings_pattern_key') THEN
    ALTER TABLE ONLY public.regional_currency_mappings
    ADD CONSTRAINT regional_currency_mappings_pattern_key UNIQUE (pattern);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regional_currency_mappings_pkey') THEN
    ALTER TABLE ONLY public.regional_currency_mappings
    ADD CONSTRAINT regional_currency_mappings_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'retailer_configs_domain_key') THEN
    ALTER TABLE ONLY public.retailer_configs
    ADD CONSTRAINT retailer_configs_domain_key UNIQUE (domain);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'retailer_configs_pkey') THEN
    ALTER TABLE ONLY public.retailer_configs
    ADD CONSTRAINT retailer_configs_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_configs_pkey') THEN
    ALTER TABLE ONLY public.site_configs
    ADD CONSTRAINT site_configs_pkey PRIMARY KEY (domain);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_status_history_pkey') THEN
    ALTER TABLE ONLY public.stock_status_history
    ADD CONSTRAINT stock_status_history_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_api_tokens_pkey') THEN
    ALTER TABLE ONLY public.system_api_tokens
    ADD CONSTRAINT system_api_tokens_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_logs_pkey') THEN
    ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_settings_pkey') THEN
    ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_memberships_pkey') THEN
    ALTER TABLE ONLY public.user_memberships
    ADD CONSTRAINT user_memberships_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_memberships_user_id_retailer_domain_key') THEN
    ALTER TABLE ONLY public.user_memberships
    ADD CONSTRAINT user_memberships_user_id_retailer_domain_key UNIQUE (user_id, retailer_domain);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
    ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey') THEN
    ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
    ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_history_product_id_fkey') THEN
    ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_groups_user_id_fkey') THEN
    ALTER TABLE ONLY public.product_groups
    ADD CONSTRAINT product_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_group_id_fkey') THEN
    ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.product_groups(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_user_id_fkey') THEN
    ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_status_history_product_id_fkey') THEN
    ALTER TABLE ONLY public.stock_status_history
    ADD CONSTRAINT stock_status_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'system_api_tokens_admin_id_fkey') THEN
    ALTER TABLE ONLY public.system_api_tokens
    ADD CONSTRAINT system_api_tokens_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_memberships_user_id_fkey') THEN
    ALTER TABLE ONLY public.user_memberships
    ADD CONSTRAINT user_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;
`);

    // --- indexes -----------------------------------------------------------
    await client.query(`
CREATE INDEX IF NOT EXISTS idx_global_currencies_iso ON public.global_currencies USING btree (iso);
CREATE INDEX IF NOT EXISTS idx_global_currencies_locale ON public.global_currencies USING btree (locale);
CREATE INDEX IF NOT EXISTS idx_price_history_product_date ON public.price_history USING btree (product_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_products_scheduler ON public.products USING btree (checking_paused, next_check_at);
CREATE INDEX IF NOT EXISTS idx_stock_history_product_date ON public.stock_status_history USING btree (product_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_system_api_tokens_hash ON public.system_api_tokens USING btree (token_hash);
CREATE INDEX IF NOT EXISTS idx_system_logs_context ON public.system_logs USING btree (context);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs USING btree (level);
`);

    // --- functions and triggers --------------------------------------------
    await client.query(`
CREATE OR REPLACE FUNCTION public.notify_settings_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM pg_notify('settings_change', TG_TABLE_NAME);
      RETURN NULL;
    END;
    $$;
`);
    await client.query(`
DROP TRIGGER IF EXISTS trigger_retailer_change ON public.retailer_configs;
CREATE TRIGGER trigger_retailer_change AFTER INSERT OR DELETE OR UPDATE ON public.retailer_configs FOR EACH STATEMENT EXECUTE FUNCTION public.notify_settings_change();
DROP TRIGGER IF EXISTS trigger_settings_change ON public.system_settings;
CREATE TRIGGER trigger_settings_change AFTER INSERT OR DELETE OR UPDATE ON public.system_settings FOR EACH STATEMENT EXECUTE FUNCTION public.notify_settings_change();
`);

    // --- seed data ---------------------------------------------------------
    await client.query(`
INSERT INTO system_settings (key, value) VALUES
  ('ai_max_retries', '2'),
  ('ai_timeout', '30000'),
  ('debug_page_enabled', 'true'),
  ('deepseek_model', 'deepseek-chat'),
  ('default_referrer', 'https://www.google.com/'),
  ('generic_ai_image_selectors', E'["link[rel=\\"preload\\"][as=\\"image\\"]","img#landingImage","img#main-image","img.main-image","img.hero-image","img[class*=\\"product-image\\" i]","img[class*=\\"product__image\\" i]","img[class*=\\"gallery\\" i]","img[data-testid*=\\"image\\" i]"]'),
  ('generic_ai_price_selectors', E'["[class*=\\"price\\" i]","[class*=\\"Price\\" i]","[data-testid*=\\"price\\" i]","[data-automation*=\\"price\\" i]","[data-automation*=\\"Price\\" i]","[itemprop=\\"price\\"]","[data-price]","[data-price-amount]","[data-product-price]"]'),
  ('generic_exclusion_selectors', '[]'),
  ('generic_in_stock_phrases', '["in stock", "instock", "add to cart", "add to basket", "buy now", "available now", "add to trolley", "clearance", "on sale", "special offer", "limited stock", "available", "ready to ship"]'),
  ('generic_out_of_stock_phrases', '["out of stock", "sold out", "currently unavailable", "not available", "backorder", "back-order", "notify me when available", "coming soon"]'),
  ('generic_pre_order_phrases', '["pre-order", "preorder", "available starting", "expected to ship", "release date", "pre-ordering"]'),
  ('generic_pre_order_price_selectors', '[]'),
  ('generic_stock_selectors', E'["[itemprop=\\"availability\\"]",".stock-status",".availability","[class*=\\"stock-status\\" i]","[class*=\\"availability\\" i]"]'),
  ('groq_model', 'llama-3.3-70b-versatile'),
  ('jsonld_image_key', 'image'),
  ('jsonld_name_key', 'name'),
  ('jsonld_price_key', 'price'),
  ('mistral_model', 'mistral-large-latest'),
  ('prefer_jsonld_image', 'true'),
  ('registration_enabled', 'true'),
  ('retailer_updates_disabled', 'false'),
  ('scheduler_disabled', 'false'),
  ('searxng_enabled', 'false'),
  ('searxng_url', '')
ON CONFLICT (key) DO NOTHING;
`);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const down = async ({ context: pool }: { context: MigrationContext }) => {
  // Intentionally a no-op. This is a baseline; tearing it down would drop every
  // table in the database.
};
