CREATE TABLE IF NOT EXISTS farms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_token  text NOT NULL UNIQUE,
  room_code     text NOT NULL,
  resources     jsonb NOT NULL DEFAULT '{"acorns":0,"wood":0,"gems":0,"blueberries":0,"sunflowerSeeds":0,"petals":0,"wheat":0}',
  plots         jsonb NOT NULL DEFAULT '[]',
  seeds         jsonb NOT NULL DEFAULT '{"sunflower":0,"blueberry":0,"wheat":0}',
  tutorial_done boolean NOT NULL DEFAULT false,
  tutorial_step int NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_farms" ON farms FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_farms_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER farms_updated_at
BEFORE UPDATE ON farms
FOR EACH ROW EXECUTE FUNCTION update_farms_timestamp();
