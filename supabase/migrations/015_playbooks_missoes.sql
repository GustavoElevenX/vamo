-- ============================================================
-- 015: Playbooks de Coaching nas Missões (Módulo 4)
-- ============================================================

-- Adicionar campo de playbook às missões de IA
ALTER TABLE ai_missions ADD COLUMN IF NOT EXISTS playbook_content jsonb;

-- Estrutura esperada de playbook_content:
-- {
--   "por_que_voce_recebe": "Texto explicando com base no DISC...",
--   "passos": ["Passo 1...", "Passo 2...", "Passo 3..."],
--   "nao_fazer": "O erro mais comum...",
--   "frase_gatilho": "Quando o cliente disser X, diga Y...",
--   "simulador_link": true/false
-- }
