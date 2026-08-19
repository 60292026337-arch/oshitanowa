import { createClient } from "@supabase/supabase-js";

// 環境変数が取得できない場合のフォールバック値
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://vrvvwmtqmhmiquynafcv.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZydnZ3bXRxbWhtaXF1eW5hZmN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMTYyOTQsImV4cCI6MjEwMjY5MjI5NH0.-65inUMlJQydxzYufZZdSPsAJ-zS_cf6LxnLqLYKPaY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
