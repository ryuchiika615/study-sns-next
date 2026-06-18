ALTER TABLE surveys ADD COLUMN IF NOT EXISTS anonymous boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "responses_select" ON survey_responses;
CREATE POLICY "responses_select" ON survey_responses FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  OR EXISTS (SELECT 1 FROM surveys WHERE id = survey_id AND anonymous = false)
);
