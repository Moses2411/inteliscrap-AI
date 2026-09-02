-- ============================================================================
-- InteliScrap AI — Canonical PostgreSQL + PostGIS schema
-- P2P recycling micro-marketplace (Zaria / Kaduna, Northern Nigeria)
--
-- Applied to production PostgreSQL 15+ via `psql -f schema.sql` or Alembic.
-- Coordinates are stored as lat/long floats (portable). The `geom` columns are
-- PostGIS GENERATED columns kept in sync automatically and used for nearest
-- collector route matching via ST_DWithin / <-> KNN GiST indexes.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- users  (Household, Collector, Admin, NGO)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id              VARCHAR(36) PRIMARY KEY,
    phone_number    VARCHAR(20)  NOT NULL UNIQUE,
    full_name       VARCHAR(120),
    role            VARCHAR(20)  NOT NULL DEFAULT 'household'
                    CHECK (role IN ('household', 'collector', 'admin', 'ngo')),
    language_pref   VARCHAR(8)   NOT NULL DEFAULT 'ha',
    location_hub    VARCHAR(64)  NOT NULL DEFAULT 'Zaria',
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    geom            GEOMETRY(Point, 4326)
                    GENERATED ALWAYS AS (
                        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
                    ) STORED,
    otp_code        VARCHAR(6),
    otp_expires_at  TIMESTAMPTZ,
    is_verified     BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    last_seen_at    TIMESTAMPTZ,
    device_id       VARCHAR(64),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role_active   ON users (role, is_active);
CREATE INDEX idx_users_geom          ON users USING GIST (geom);
CREATE INDEX idx_users_location_hub  ON users (location_hub);

-- ----------------------------------------------------------------------------
-- material_categories  (price matrix + carbon factors for M&E)
-- ----------------------------------------------------------------------------
CREATE TABLE material_categories (
    id                     SERIAL PRIMARY KEY,
    slug                   VARCHAR(60)   NOT NULL UNIQUE,
    name                   VARCHAR(80)   NOT NULL,
    name_ha                VARCHAR(80),
    name_pcm               VARCHAR(80),
    grade                  VARCHAR(40),
    unit                   VARCHAR(16)   NOT NULL DEFAULT 'kg',
    price_per_kg_naira     NUMERIC(12,2) NOT NULL,
    carbon_kg_co2e_per_kg  NUMERIC(10,4) NOT NULL DEFAULT 0,
    is_hazardous           BOOLEAN       NOT NULL DEFAULT FALSE,
    sort_order             INTEGER       NOT NULL DEFAULT 0,
    is_active              BOOLEAN       NOT NULL DEFAULT TRUE,
    updated_by             VARCHAR(36),
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (name, grade)
);

-- ----------------------------------------------------------------------------
-- listings  (household scrap offer, created from on-device scan/estimate)
-- ----------------------------------------------------------------------------
CREATE TABLE listings (
    id                     VARCHAR(36) PRIMARY KEY,
    seller_id              VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    material_category_id   INTEGER     NOT NULL REFERENCES material_categories(id),
    title                  VARCHAR(160),
    description            TEXT,
    photo_url              VARCHAR(512),
    thumbnail_url          VARCHAR(512),
    estimated_weight_kg    NUMERIC(10,3),
    actual_weight_kg       NUMERIC(10,3),
    estimated_value_naira  NUMERIC(12,2),
    final_value_naira      NUMERIC(12,2),
    confidence_score       REAL        NOT NULL DEFAULT 0,
    toxicity_hazards       JSONB,
    latitude               DOUBLE PRECISION,
    longitude              DOUBLE PRECISION,
    geom                   GEOMETRY(Point, 4326)
                           GENERATED ALWAYS AS (
                               ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
                           ) STORED,
    address_text           VARCHAR(320),
    status                 VARCHAR(20)  NOT NULL DEFAULT 'active'
                           CHECK (status IN ('draft','active','matched','scheduled','completed','cancelled','expired')),
    expires_at             TIMESTAMPTZ,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_listings_seller         ON listings (seller_id);
CREATE INDEX idx_listings_status         ON listings (status);
CREATE INDEX idx_listings_material       ON listings (material_category_id);
CREATE INDEX idx_listings_geom           ON listings USING GIST (geom);
CREATE INDEX idx_listings_status_expires ON listings (status, expires_at);

-- ----------------------------------------------------------------------------
-- pickups  (collector bid / dispatch / acceptance)
-- ----------------------------------------------------------------------------
CREATE TABLE pickups (
    id                     VARCHAR(36) PRIMARY KEY,
    listing_id             VARCHAR(36) NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    collector_id           VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    status                 VARCHAR(20)  NOT NULL DEFAULT 'offered'
                           CHECK (status IN ('offered','accepted','rejected','en_route','arrived','verified','completed','cancelled','expired')),
    offered_price_naira    NUMERIC(12,2),
    distance_m             DOUBLE PRECISION,
    scheduled_at           TIMESTAMPTZ,
    accepted_at            TIMESTAMPTZ,
    estimated_arrival_min  INTEGER,
    sms_message_id         VARCHAR(64),
    ussd_session_id        VARCHAR(64),
    ivr_call_sid           VARCHAR(64),
    reject_reason          VARCHAR(255),
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_pickups_listing   ON pickups (listing_id);
CREATE INDEX idx_pickups_collector ON pickups (collector_id);
CREATE INDEX idx_pickups_status    ON pickups (status);

-- ----------------------------------------------------------------------------
-- transactions  (settled exchange between household and collector)
-- ----------------------------------------------------------------------------
CREATE TABLE transactions (
    id                       VARCHAR(36) PRIMARY KEY,
    pickup_id                VARCHAR(36) NOT NULL UNIQUE REFERENCES pickups(id) ON DELETE RESTRICT,
    seller_id                VARCHAR(36) NOT NULL REFERENCES users(id),
    collector_id             VARCHAR(36) NOT NULL REFERENCES users(id),
    material_category_id     INTEGER     NOT NULL REFERENCES material_categories(id),
    weight_kg                NUMERIC(10,3) NOT NULL,
    unit_price_naira         NUMERIC(12,2) NOT NULL,
    gross_value_naira        NUMERIC(12,2) NOT NULL,
    platform_fee_naira       NUMERIC(12,2) NOT NULL DEFAULT 0,
    collector_earnings_naira NUMERIC(12,2) NOT NULL DEFAULT 0,
    seller_payout_naira      NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_method           VARCHAR(20)
                             CHECK (payment_method IN ('cash','mobile_money','bank_transfer')),
    payment_reference        VARCHAR(120),
    status                   VARCHAR(20)  NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','settled','disputed','cancelled','refunded')),
    settled_at               TIMESTAMPTZ,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_seller     ON transactions (seller_id);
CREATE INDEX idx_transactions_collector  ON transactions (collector_id);
CREATE INDEX idx_transactions_status     ON transactions (status);
CREATE INDEX idx_transactions_settled_at ON transactions (settled_at);

-- ----------------------------------------------------------------------------
-- ngo_impact_logs  (M&E: tonnage, carbon offset, collector income)
-- ----------------------------------------------------------------------------
CREATE TABLE ngo_impact_logs (
    id                      SERIAL PRIMARY KEY,
    transaction_id          VARCHAR(36) NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
    material_category_id    INTEGER     NOT NULL REFERENCES material_categories(id),
    tonnage_kg              NUMERIC(14,3) NOT NULL,
    carbon_offset_kg_co2e   NUMERIC(14,4) NOT NULL DEFAULT 0,
    collector_income_naira  NUMERIC(12,2) NOT NULL DEFAULT 0,
    hub                     VARCHAR(64)  NOT NULL DEFAULT 'Zaria',
    period                  DATE         NOT NULL,
    raw_metrics             JSONB,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_ngo_impact_period    ON ngo_impact_logs (period);
CREATE INDEX idx_ngo_impact_hub_period ON ngo_impact_logs (hub, period);
CREATE INDEX idx_ngo_impact_material  ON ngo_impact_logs (material_category_id);

-- ----------------------------------------------------------------------------
-- sync_outbox  (fault-tolerant offline sync / network retry queue)
-- ----------------------------------------------------------------------------
CREATE TABLE sync_outbox (
    id             VARCHAR(36) PRIMARY KEY,
    aggregate_type VARCHAR(40) NOT NULL,
    aggregate_id   VARCHAR(36) NOT NULL,
    event_type     VARCHAR(40) NOT NULL,
    payload        JSONB       NOT NULL,
    attempt_count  INTEGER     NOT NULL DEFAULT 0,
    next_retry_at  TIMESTAMPTZ,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','sent','failed')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_outbox_status_retry ON sync_outbox (status, next_retry_at);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at               BEFORE UPDATE ON users               FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_material_categories_updated_at BEFORE UPDATE ON material_categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_listings_updated_at            BEFORE UPDATE ON listings            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_pickups_updated_at             BEFORE UPDATE ON pickups             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_transactions_updated_at        BEFORE UPDATE ON transactions        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sync_outbox_updated_at         BEFORE UPDATE ON sync_outbox         FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Seed data: material categories (Hausa/Pidgin labels + carbon offset factors)
-- ----------------------------------------------------------------------------
INSERT INTO material_categories
    (slug, name, name_ha, name_pcm, grade, price_per_kg_naira, carbon_kg_co2e_per_kg, is_hazardous, sort_order)
VALUES
    ('copper',       'Copper',            'Tagulla',     'Copper wire',   'Grade A',   3200.00, 2.60, FALSE, 1),
    ('aluminum',     'Aluminum',          'Aluminiyam',  'Aluminum',      'Can Sheet',  700.00, 9.10, FALSE, 2),
    ('pet-plastic',  'PET Plastic',       'Robobi',      'PET bottle',    NULL,         180.00, 1.50, FALSE, 3),
    ('lead-battery', 'Lead-Acid Battery', 'Batir',       'Lead battery',  NULL,         950.00, 0.95, TRUE,  4),
    ('brass',        'Brass',             'Farin Karfe', 'Brass',         'Grade A',   2200.00, 0.80, FALSE, 5),
    ('steel',        'Steel',             'Karfe',       'Iron scrap',    NULL,          90.00, 1.80, FALSE, 6),
    ('e-waste',      'E-Waste Board',     'Na''ura',     'E-waste',       NULL,         400.00, 0.60, TRUE,  7),
    ('glass',        'Glass',             'Gilashi',     'Glass',         NULL,          25.00, 0.30, FALSE, 8);
