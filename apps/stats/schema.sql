-- Лічильники операцій. Жодних ідентифікаторів, лише суми.
CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  n   INTEGER NOT NULL DEFAULT 0
);

-- Міста беруться з краю Cloudflare і одразу агрегуються.
-- IP-адреси ніде не зберігаються й не логуються.
CREATE TABLE IF NOT EXISTS places (
  country TEXT NOT NULL,
  city    TEXT NOT NULL,
  n       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (country, city)
);

CREATE INDEX IF NOT EXISTS places_by_n ON places (n DESC);
