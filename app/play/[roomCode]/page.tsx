/* eslint-disable */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getRoomByCode, castVote, getSessionId } from "@/lib/rooms";
import { playVoteSound } from "@/lib/audio";
import type { Room } from "@/lib/database.types";

function StatusBadge({ status }: { status: Room["status"] }) {
  const map = {
    waiting:  { label: "⏳ 投票待機中", className: "bg-gray-200 text-gray-600" },
    voting:   { label: "🔴 投票受付中", className: "bg-green-100 text-green-700 animate-pulse" },
    revealed: { label: "🏆 結果発表！",  className: "bg-yellow-100 text-yellow-700" },
  };
  const { label, className } = map[status];
  return (
    <span className={`px-4 py-1.5 rounded-full text-sm font-black ${className}`}>
      {label}
    </span>
  );
}

export default function PlayPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const router = useRouter();
  const sessionId = useRef<string>("");

  const [room, setRoom] = useState<Room | null>(null);
  const [myVote, setMyVote] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [voteTotal, setVoteTotal] = useState(0);
  const [submitError, setSubmitError] = useState("");

  // ──── 初期ロード ────
  useEffect(() => {
    sessionId.current = getSessionId();

    async function init() {
      const r = await getRoomByCode(roomCode);
      if (!r) { setNotFound(true); setIsLoading(false); return; }
      setRoom(r);

      // 既投票チェック
      const stored = sessionStorage.getItem(`vote_${r.id}`);
      if (stored !== null) setMyVote(stored === "true");

      setIsLoading(false);
    }
    init();
  }, [roomCode]);

  // ──── Realtime 購読 ────
  useEffect(() => {
    if (!room) return;

    const roomCh = supabase
      .channel(`play-room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as Room;
          setRoom(updated);
          // お題が変わった or waiting に戻ったら投票リセット
          if (
            updated.current_question !== room.current_question ||
            updated.status === "waiting"
          ) {
            setMyVote(null);
            sessionStorage.removeItem(`vote_${room.id}`);
          }
        }
      )
      .subscribe();

    const votesCh = supabase
      .channel(`play-votes-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${room.id}` },
        async () => {
          const { count } = await (supabase as any)
            .from("votes")
            .select("*", { count: "exact", head: true })
            .eq("room_id", room.id);
          setVoteTotal(count ?? 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomCh);
      supabase.removeChannel(votesCh);
    };
  }, [room]);

  // ──── 投票送信 ────
  const handleVote = useCallback(async (choice: boolean) => {
    if (!room || room.status !== "voting" || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      await castVote(room.id, sessionId.current, choice);
      setMyVote(choice);
      sessionStorage.setItem(`vote_${room.id}`, String(choice));
      playVoteSound(choice);
    } catch (e) {
      console.error(e);
      setSubmitError("送信に失敗しました。もう一度タップしてください。");
    } finally {
      setIsSubmitting(false);
    }
  }, [room, isSubmitting]);

  // ──── ローディング ────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-600">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-16 h-16 text-white" />
        </motion.div>
      </div>
    );
  }

  // ──── 部屋が見つからない ────
  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-pink-400 to-purple-600">
        <p className="text-white font-black text-2xl text-center mb-6">
          😢 部屋が見つかりません
        </p>
        <p className="text-white/70 text-center mb-8">ルームコードを確認してください。</p>
        <button
          onClick={() => router.push("/")}
          className="btn-3d px-8 py-4 bg-white text-purple-700 font-black text-xl"
          style={{ boxShadow: "0 6px 0 #a855f7" }}
        >
          トップへ戻る
        </button>
      </div>
    );
  }

  if (!room) return null;

  const isVoting   = room.status === "voting";
  const isRevealed = room.status === "revealed";
  const hasVoted   = myVote !== null;

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">

      {/* ─── トップバー ─── */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => router.push("/")}
          className="text-white/60 hover:text-white transition-colors font-bold flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">退出</span>
        </button>
        <div className="text-center">
          <p className="text-white/60 text-xs font-bold">ルームコード</p>
          <p className="text-white font-black text-xl tracking-widest">
            {roomCode.toUpperCase()}
          </p>
        </div>
        <StatusBadge status={room.status} />
      </div>

      {/* ─── メイン ─── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">

        {/* お題表示 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={room.current_question || room.status}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm"
          >
            {room.status === "waiting" || !room.current_question ? (
              <div className="text-center py-12">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-6xl mb-4"
                >
                  ⏳
                </motion.div>
                <p className="text-white/70 font-black text-xl">ホストがお題を設定中...</p>
                <p className="text-white/40 text-sm mt-2">もうしばらくお待ちください</p>
              </div>
            ) : (
              <div className="pop-card bg-white/15 border-white/30 p-6 text-center backdrop-blur-sm">
                <p className="text-white/60 text-sm font-bold mb-2">📢 お題</p>
                <p
                  className="text-white font-black text-2xl md:text-3xl leading-tight"
                  style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.3)" }}
                >
                  {room.current_question}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ──── 投票ボタン（voting 中） ──── */}
        <AnimatePresence>
          {isVoting && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="w-full max-w-sm space-y-4"
            >
              {!hasVoted ? (
                <>
                  <p className="text-white/70 text-center font-bold text-sm">
                    タップして投票してください
                  </p>

                  {/* はい */}
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.94, y: 6 }}
                    onClick={() => handleVote(true)}
                    disabled={isSubmitting}
                    className="btn-3d w-full py-10 text-white text-4xl font-black
                               bg-gradient-to-b from-pink-400 to-rose-600
                               disabled:opacity-50"
                    style={{ boxShadow: "0 10px 0 #9f1239" }}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-10 h-10 animate-spin mx-auto" />
                    ) : (
                      <><span className="text-5xl">😊</span><br /><span>はい</span></>
                    )}
                  </motion.button>

                  {/* いいえ */}
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.94, y: 6 }}
                    onClick={() => handleVote(false)}
                    disabled={isSubmitting}
                    className="btn-3d w-full py-10 text-white text-4xl font-black
                               bg-gradient-to-b from-cyan-400 to-blue-600
                               disabled:opacity-50"
                    style={{ boxShadow: "0 10px 0 #1e3a8a" }}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-10 h-10 animate-spin mx-auto" />
                    ) : (
                      <><span className="text-5xl">😅</span><br /><span>いいえ</span></>
                    )}
                  </motion.button>

                  {submitError && (
                    <p className="text-red-300 text-center font-bold text-sm">
                      ⚠️ {submitError}
                    </p>
                  )}
                </>
              ) : (
                /* ──── 投票済み ──── */
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className={`pop-card p-8 text-center border-4
                    ${myVote ? "bg-pink-500/30 border-pink-400" : "bg-blue-500/30 border-blue-400"}`}
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-6xl mb-3"
                  >
                    {myVote ? "😊" : "😅"}
                  </motion.div>
                  <p className={`font-black text-4xl mb-2
                    ${myVote ? "text-pink-300" : "text-blue-300"}`}>
                    「{myVote ? "はい" : "いいえ"}」
                  </p>
                  <p className="text-white/80 font-black text-lg mb-1">で回答しました！</p>
                  <p className="text-white/50 text-sm">変更したい場合は下のボタンから</p>

                  <button
                    onClick={() => {
                      setMyVote(null);
                      sessionStorage.removeItem(`vote_${room.id}`);
                    }}
                    className="mt-4 text-white/50 hover:text-white text-sm font-bold underline transition-colors"
                  >
                    回答を変更する
                  </button>
                </motion.div>
              )}

              {/* リアルタイム回答数 */}
              <div className="text-center">
                <motion.p
                  key={voteTotal}
                  initial={{ scale: 1.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-white/50 text-sm font-bold"
                >
                  現在 {voteTotal} 人が回答済み
                </motion.p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 結果発表待ちメッセージ */}
        {isVoting && hasVoted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-white/60"
          >
            <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: "3s" }} />
            <span className="text-sm font-bold">ホストの結果発表をお待ちください</span>
          </motion.div>
        )}

        {/* ──── 結果発表！（revealed） ──── */}
        <AnimatePresence>
          {isRevealed && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 150, damping: 12 }}
              className="w-full max-w-sm pop-card bg-gradient-to-br from-yellow-400 to-orange-500
                         border-yellow-600 p-8 text-center"
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1.5 }}
                className="text-6xl mb-3"
              >
                🏆
              </motion.div>
              <p className="text-white font-black text-2xl mb-1">結果発表中！</p>
              <p className="text-yellow-900/70 font-bold text-sm">ホスト画面をご覧ください</p>

              {myVote !== null && (
                <div className={`mt-4 px-4 py-2 rounded-xl font-black
                  ${myVote ? "bg-pink-500/30 text-white" : "bg-blue-500/30 text-white"}`}>
                  <CheckCircle2 className="inline-block w-4 h-4 mr-1" />
                  あなたは「{myVote ? "はい" : "いいえ"}」と回答しました
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── フッター ─── */}
      <div className="p-4 text-center">
        <p className="text-white/30 text-xs font-bold">
          🔒 投票は完全匿名 · あなたの回答は誰にも知られません
        </p>
      </div>
    </main>
  );
}
