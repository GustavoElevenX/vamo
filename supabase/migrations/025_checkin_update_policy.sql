-- 025: Adiciona política UPDATE em daily_checkins (faltava para upsert via RLS)

CREATE POLICY "Users can update own checkins"
  ON daily_checkins FOR UPDATE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
