/* eslint-disable */
import { supabase } from "./supabase";
import type { Room, RoomStatus, VoteCounts } from "./database.types";

/** 4桁ランダムルームコード生成（紛らわしい文字を除外）*/
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

/** ブラウザセッションID取得・生成 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  const key = "oshitanowa_session_id";
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

/** 新規ルーム作成 */
export async function createRoom(): Promise<Room> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const room_code = generateRoomCode();
    const { data, error } = await (supabase as any)
      .from("rooms")
      .insert({ room_code, status: "waiting", current_question: "" })
      .select()
      .single();

    if (!error && data) return data as Room;
    if (error && !(error.message as string).includes("unique")) throw error;
  }
  throw new Error("ルームコードの生成に失敗しました。もう一度お試しください。");
}

/** ルームコードからルーム取得 */
export async function getRoomByCode(roomCode: string): Promise<Room | null> {
  const { data, error } = await (supabase as any)
    .from("rooms")
    .select("*")
    .eq("room_code", roomCode.toUpperCase())
    .single();

  if (error) return null;
  return data as Room;
}

/** ルーム更新 */
export async function updateRoom(
  roomId: string,
  updates: { status?: RoomStatus; current_question?: string }
): Promise<void> {
  const { error } = await (supabase as any)
    .from("rooms")
    .update(updates)
    .eq("id", roomId);
  if (error) throw error;
}

/** 投票送信（同一セッションは UPSERT で上書き）*/
export async function castVote(
  roomId: string,
  sessionId: string,
  choice: boolean
): Promise<void> {
  const { error } = await (supabase as any)
    .from("votes")
    .upsert(
      { room_id: roomId, session_id: sessionId, choice },
      { onConflict: "room_id,session_id" }
    );
  if (error) throw error;
}

/** 投票集計取得（COUNT のみ・匿名性担保）*/
export async function getVoteCounts(roomId: string): Promise<VoteCounts> {
  const { data, error } = await (supabase as any)
    .from("votes")
    .select("choice")
    .eq("room_id", roomId);

  if (error) throw error;

  const rows = (data ?? []) as { choice: boolean }[];
  const yes = rows.filter((v) => v.choice === true).length;
  const no  = rows.filter((v) => v.choice === false).length;
  return { yes, no, total: yes + no };
}

/** 全票削除（リセット用）*/
export async function clearVotes(roomId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("votes")
    .delete()
    .eq("room_id", roomId);
  if (error) throw error;
}
