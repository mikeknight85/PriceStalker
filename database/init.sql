--
-- PostgreSQL database dump
--



-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: notify_settings_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_settings_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM pg_notify('settings_change', TG_TABLE_NAME);
      RETURN NULL;
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_rates (
    id integer NOT NULL,
    from_currency character varying(10) NOT NULL,
    to_currency character varying(10) NOT NULL,
    rate numeric(20,10) NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: exchange_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exchange_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exchange_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exchange_rates_id_seq OWNED BY public.exchange_rates.id;


--
-- Name: global_currencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.global_currencies (
    id integer NOT NULL,
    country_territory text,
    currency_name text,
    iso character varying(10) NOT NULL,
    symbol text,
    locale character varying(10) NOT NULL,
    separation character varying(10),
    "position" character varying(10)
);


--
-- Name: global_currencies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.global_currencies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: global_currencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.global_currencies_id_seq OWNED BY public.global_currencies.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    name character varying(255) NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    type character varying(50) NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_history (
    id integer NOT NULL,
    product_id integer,
    price numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::character varying,
    recorded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ai_status character varying(20),
    price_type character varying(20) DEFAULT 'standard'::character varying,
    details jsonb
);


--
-- Name: price_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.price_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: price_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.price_history_id_seq OWNED BY public.price_history.id;


--
-- Name: product_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_groups (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    category character varying(255),
    image_url text,
    user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: product_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_groups_id_seq OWNED BY public.product_groups.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
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


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: regional_currency_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regional_currency_mappings (
    id integer NOT NULL,
    pattern character varying(50) NOT NULL,
    currency character varying(10) NOT NULL,
    match_type character varying(20) NOT NULL,
    active boolean DEFAULT true
);


--
-- Name: regional_currency_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.regional_currency_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regional_currency_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.regional_currency_mappings_id_seq OWNED BY public.regional_currency_mappings.id;


--
-- Name: retailer_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retailer_configs (
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


--
-- Name: retailer_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.retailer_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: retailer_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.retailer_configs_id_seq OWNED BY public.retailer_configs.id;


--
-- Name: site_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_configs (
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


--
-- Name: stock_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_status_history (
    id integer NOT NULL,
    product_id integer,
    status character varying(20) NOT NULL,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: stock_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_status_history_id_seq OWNED BY public.stock_status_history.id;


--
-- Name: system_api_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_api_tokens (
    id integer NOT NULL,
    admin_id integer,
    token_hash character varying(255) NOT NULL,
    label character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    last_used_at timestamp without time zone
);


--
-- Name: system_api_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_api_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_api_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_api_tokens_id_seq OWNED BY public.system_api_tokens.id;


--
-- Name: system_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_logs (
    id integer NOT NULL,
    level character varying(20) NOT NULL,
    context character varying(50),
    message text NOT NULL,
    details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: system_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_memberships (
    id integer NOT NULL,
    user_id integer NOT NULL,
    retailer_domain text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_memberships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_memberships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_memberships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_memberships_id_seq OWNED BY public.user_memberships.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
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


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: exchange_rates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates ALTER COLUMN id SET DEFAULT nextval('public.exchange_rates_id_seq'::regclass);


--
-- Name: global_currencies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_currencies ALTER COLUMN id SET DEFAULT nextval('public.global_currencies_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: price_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history ALTER COLUMN id SET DEFAULT nextval('public.price_history_id_seq'::regclass);


--
-- Name: product_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_groups ALTER COLUMN id SET DEFAULT nextval('public.product_groups_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: regional_currency_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regional_currency_mappings ALTER COLUMN id SET DEFAULT nextval('public.regional_currency_mappings_id_seq'::regclass);


--
-- Name: retailer_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retailer_configs ALTER COLUMN id SET DEFAULT nextval('public.retailer_configs_id_seq'::regclass);


--
-- Name: stock_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_status_history ALTER COLUMN id SET DEFAULT nextval('public.stock_status_history_id_seq'::regclass);


--
-- Name: system_api_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_api_tokens ALTER COLUMN id SET DEFAULT nextval('public.system_api_tokens_id_seq'::regclass);


--
-- Name: system_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_logs ALTER COLUMN id SET DEFAULT nextval('public.system_logs_id_seq'::regclass);


--
-- Name: user_memberships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memberships ALTER COLUMN id SET DEFAULT nextval('public.user_memberships_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: exchange_rates exchange_rates_from_currency_to_currency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_from_currency_to_currency_key UNIQUE (from_currency, to_currency);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: global_currencies global_currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_currencies
    ADD CONSTRAINT global_currencies_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (name);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);


--
-- Name: product_groups product_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_groups
    ADD CONSTRAINT product_groups_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_user_id_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_url_key UNIQUE (user_id, url);


--
-- Name: regional_currency_mappings regional_currency_mappings_pattern_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regional_currency_mappings
    ADD CONSTRAINT regional_currency_mappings_pattern_key UNIQUE (pattern);


--
-- Name: regional_currency_mappings regional_currency_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regional_currency_mappings
    ADD CONSTRAINT regional_currency_mappings_pkey PRIMARY KEY (id);


--
-- Name: retailer_configs retailer_configs_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retailer_configs
    ADD CONSTRAINT retailer_configs_domain_key UNIQUE (domain);


--
-- Name: retailer_configs retailer_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retailer_configs
    ADD CONSTRAINT retailer_configs_pkey PRIMARY KEY (id);


--
-- Name: site_configs site_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_configs
    ADD CONSTRAINT site_configs_pkey PRIMARY KEY (domain);


--
-- Name: stock_status_history stock_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_status_history
    ADD CONSTRAINT stock_status_history_pkey PRIMARY KEY (id);


--
-- Name: system_api_tokens system_api_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_api_tokens
    ADD CONSTRAINT system_api_tokens_pkey PRIMARY KEY (id);


--
-- Name: system_logs system_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: user_memberships user_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memberships
    ADD CONSTRAINT user_memberships_pkey PRIMARY KEY (id);


--
-- Name: user_memberships user_memberships_user_id_retailer_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memberships
    ADD CONSTRAINT user_memberships_user_id_retailer_domain_key UNIQUE (user_id, retailer_domain);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_global_currencies_iso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_global_currencies_iso ON public.global_currencies USING btree (iso);


--
-- Name: idx_global_currencies_locale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_global_currencies_locale ON public.global_currencies USING btree (locale);


--
-- Name: idx_price_history_product_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_history_product_date ON public.price_history USING btree (product_id, recorded_at);


--
-- Name: idx_products_scheduler; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_scheduler ON public.products USING btree (checking_paused, next_check_at);


--
-- Name: idx_stock_history_product_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_history_product_date ON public.stock_status_history USING btree (product_id, changed_at);


--
-- Name: idx_system_api_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_api_tokens_hash ON public.system_api_tokens USING btree (token_hash);


--
-- Name: idx_system_logs_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_logs_context ON public.system_logs USING btree (context);


--
-- Name: idx_system_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_logs_created_at ON public.system_logs USING btree (created_at DESC);


--
-- Name: idx_system_logs_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_logs_level ON public.system_logs USING btree (level);


--
-- Name: retailer_configs trigger_retailer_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_retailer_change AFTER INSERT OR DELETE OR UPDATE ON public.retailer_configs FOR EACH STATEMENT EXECUTE FUNCTION public.notify_settings_change();


--
-- Name: system_settings trigger_settings_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_settings_change AFTER INSERT OR DELETE OR UPDATE ON public.system_settings FOR EACH STATEMENT EXECUTE FUNCTION public.notify_settings_change();


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: price_history price_history_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_groups product_groups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_groups
    ADD CONSTRAINT product_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: products products_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.product_groups(id) ON DELETE SET NULL;


--
-- Name: products products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stock_status_history stock_status_history_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_status_history
    ADD CONSTRAINT stock_status_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: system_api_tokens system_api_tokens_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_api_tokens
    ADD CONSTRAINT system_api_tokens_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_memberships user_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memberships
    ADD CONSTRAINT user_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

