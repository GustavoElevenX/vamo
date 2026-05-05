-- Campos minimos para a comissao depender do dinheiro recebido.
ALTER TABLE crm_deals
  ADD COLUMN IF NOT EXISTS received_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS category_id TEXT,
  ADD COLUMN IF NOT EXISTS category_name TEXT,
  ADD COLUMN IF NOT EXISTS commercial_table_id TEXT,
  ADD COLUMN IF NOT EXISTS commercial_table_name TEXT;

CREATE INDEX IF NOT EXISTS idx_deal_payment_receipts_deal_status
  ON deal_payment_receipts(deal_id, status);

CREATE INDEX IF NOT EXISTS idx_commission_line_items_deal
  ON commission_line_items(deal_id);

CREATE INDEX IF NOT EXISTS idx_pdi_applications_status
  ON pdi_applications(organization_id, status, created_at DESC);
