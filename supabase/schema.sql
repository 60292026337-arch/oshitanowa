-- ========================================
-- 「押したのは誰だ！？」 Supabase Schema
-- ========================================

-- rooms テーブル
CREATE TABLE IF NOT EXISTS public.rooms (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code        text        NOT NULL UNIQUE,
  current_question text        NOT NULL DEFAULT '',
  status           text        NOT NULL DEFAULT 'waiting'
                               CHECK (status IN ('waiting', 'voting', 'revealed')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- votes テーブル
CREATE TABLE IF NOT EXISTS public.votes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    uuid        NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  session_id text        NOT NULL,
  choice     boolean     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, session_id)   -- 1セッション1票（UPSERTで上書き可能）
);

-- インデックス
CREATE INDEX IF NOT EXISTS votes_room_id_idx  ON public.votes (room_id);
CREATE INDEX IF NOT EXISTS rooms_room_code_idx ON public.rooms (room_code);

-- ========================================
-- Row Level Security (RLS)
-- ========================================

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- rooms: 全員が読み書き可（anon キーで操作）
CREATE POLICY "rooms_select" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update" ON public.rooms FOR UPDATE USING (true);

-- votes: 全員が読み書き・削除可（匿名投票）
CREATE POLICY "votes_select" ON public.votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON public.votes FOR INSERT WITH CHECK (true);
CREATE POLICY "votes_update" ON public.votes FOR UPDATE USING (true);
CREATE POLICY "votes_delete" ON public.votes FOR DELETE USING (true);

-- ========================================
-- Realtime 有効化
-- ========================================
BEGIN;
  ALTER TABLE public.rooms REPLICA IDENTITY FULL;
  ALTER TABLE public.votes REPLICA IDENTITY FULL;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
