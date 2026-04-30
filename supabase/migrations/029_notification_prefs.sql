CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  whatsapp_number TEXT,
  notify_deal_stuck BOOLEAN NOT NULL DEFAULT true,
  notify_daily_digest BOOLEAN NOT NULL DEFAULT true,
  notify_deal_closed BOOLEAN NOT NULL DEFAULT true,
  notify_ranking_change BOOLEAN NOT NULL DEFAULT false,
  digest_hour_utc INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  reference TEXT,
  channel TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, type, reference, channel)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_prefs_own" ON notification_preferences;
CREATE POLICY "notif_prefs_own" ON notification_preferences
  FOR ALL USING (user_id = get_user_id())
  WITH CHECK (user_id = get_user_id());

DROP POLICY IF EXISTS "notif_send_log_own_or_manager" ON notification_send_log;
CREATE POLICY "notif_send_log_own_or_manager" ON notification_send_log
  FOR ALL USING (
    user_id = get_user_id() OR get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    user_id = get_user_id() OR get_user_role() IN ('manager', 'admin')
  );
