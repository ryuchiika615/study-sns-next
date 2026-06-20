ALTER TABLE surveys ADD COLUMN IF NOT EXISTS results_published_at timestamptz;

DROP POLICY IF EXISTS "surveys_select" ON surveys;
CREATE POLICY "surveys_select" ON surveys FOR SELECT USING (
  closed_at IS NULL
  OR results_published_at IS NOT NULL
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
