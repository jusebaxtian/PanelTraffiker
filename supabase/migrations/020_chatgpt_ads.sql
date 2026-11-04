-- Cuenta publicitaria de ChatGPT Ads conectada al panel (módulo "ChatGPT
-- Ads"). Cada llave de la Advertiser API de OpenAI corresponde a una sola
-- cuenta; se guarda igual que los tokens de meta_ad_accounts.
create table if not exists chatgpt_ads_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_key text not null,
  created_at timestamptz not null default now()
);
alter table chatgpt_ads_accounts enable row level security;
