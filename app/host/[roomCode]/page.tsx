/* eslint-disable */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import {
  Play, RefreshCw, Eye, Mic2, Users,
  Copy, Check, ChevronRight, RotateCcw, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getRoomByCode, updateRoom, getVoteCounts, clearVotes } from "@/lib/rooms";
import type { RoomStatus } from "@/lib/database.types";
import { playDrumRoll, stopDrumRoll, playCymbal, playTickSound } from "@/lib/audio";
import type { Room, VoteCounts } from "@/lib/database.types";

// ─── カウントアップフック ───
function useCountUp(target: number, duration = 1400, run = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) { setValue(0); return; }
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, run]);
  return value;
}

export default function HostPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const router = useRouter();

  const [room, setRoom] = useState<Room | null>(null);
  const [question, setQuestion] = useState("");
  const [voteCount, setVoteCount] = useState(0);
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({ yes: 0, no: 0, total: 0 });
  const [isRevealing, setIsRevealing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const drumTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const playUrl = `${appUrl}/play/${roomCode}`;

  const yesCount   = useCountUp(voteCounts.yes,   1400, showResult);
  const noCount    = useCountUp(voteCounts.no,    1400, showResult);
  const totalCount = useCountUp(voteCounts.total, 1400, showResult);

  // ──── 初期ロード ────
  useEffect(() => {
    async function init() {
      const r = await getRoomByCode(roomCode);
      if (!r) { router.push("/"); return; }
      setRoom(r);
      setQuestion(r.current_question);
      if (r.status === "voting" || r.status === "revealed") {
        const counts = await getVoteCounts(r.id);
        setVoteCount(counts.total);
        if (r.status === "revealed") {
          setVoteCounts(counts);
          setShowResult(true);
        }
      }
      setIsLoading(false);
    }
    init();
  }, [roomCode, router]);

  // ──── Realtime 購読 ────
  useEffect(() => {
    if (!room) return;

    const roomCh = supabase
      .channel(`host-room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => setRoom(payload.new as Room)
      )
      .subscribe();

    const votesCh = supabase
      .channel(`host-votes-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${room.id}` },
        async () => {
          const counts = await getVoteCounts(room.id);
          setVoteCount(counts.total);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomCh);
      supabase.removeChannel(votesCh);
    };
  }, [room]);

  // ──── 投票開始 ────
  const handleStartVoting = useCallback(async () => {
    if (!room || !question.trim()) return;
    setError("");
    setShowResult(false);
    setVoteCounts({ yes: 0, no: 0, total: 0 });
    setVoteCount(0);
    await clearVotes(room.id);
    await updateRoom(room.id, { status: "voting" as RoomStatus, current_question: question.trim() });
    setRoom((r) => r ? { ...r, status: "voting", current_question: question.trim() } : r);
  }, [room, question]);

  // ──── 結果発表（ドラムロール 3秒 → シンバル → 表示）────
  const handleReveal = useCallback(async () => {
    if (!room || isRevealing) return;
    setIsRevealing(true);

    const counts = await getVoteCounts(room.id);
    setVoteCounts(counts);

    playDrumRoll(3.0);

    drumTimerRef.current = setTimeout(async () => {
      stopDrumRoll();
      playCymbal();
      await updateRoom(room.id, { status: "revealed" as RoomStatus });
      setRoom((r) => r ? { ...r, status: "revealed" } : r);
      setShowResult(true);
      setIsRevealing(false);
    }, 3000);
  }, [room, isRevealing]);

  // ──── リセット / 次のお題 ────
  const handleReset = useCallback(async () => {
    if (!room) return;
    if (drumTimerRef.current) clearTimeout(drumTimerRef.current);
    stopDrumRoll();
    await clearVotes(room.id);
    await updateRoom(room.id, { status: "waiting" as RoomStatus, current_question: "" });
    setRoom((r) => r ? { ...r, status: "waiting", current_question: "" } : r);
    setQuestion("");
    setVoteCount(0);
    setVoteCounts({ yes: 0, no: 0, total: 0 });
    setShowResult(false);
    setIsRevealing(false);
  }, [room]);

  // ──── ルームコードコピー ────
  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode.toUpperCase()).then(() => {
      setCopied(true);
      playTickSound();
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ──── ローディング ────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-400 to-purple-600">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-6xl"
        >
          🎉
        </motion.div>
      </div>
    );
  }

  if (!room) return null;

  const isVoting   = room.status === "voting";
  const isRevealed = room.status === "revealed";
  const yesPercent = voteCounts.total > 0
    ? Math.round((voteCounts.yes / voteCounts.total) * 100) : 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4 md:p-6">

      {/* ─── ヘッダー ─── */}
      <div className="flex items-center justify-between mb-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="bg-pink-500 rounded-2xl p-2.5 shadow-lg">
            <Mic2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-black text-xl md:text-2xl">押したのは誰だ！？</h1>
            <p className="text-purple-300 text-sm font-medium">ホスト画面</p>
          </div>
        </div>
        <button
          onClick={() => router.push("/")}
          className="text-purple-300 hover:text-white transition-colors text-sm font-bold"
        >
          ← トップへ
        </button>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ─── 左カラム: QRコード・ルームコード・参加者数 ─── */}
        <div className="space-y-4">

          {/* QRコード */}
          <div className="pop-card bg-white border-yellow-300 p-5 text-center">
            <h2 className="font-black text-gray-700 mb-3 text-lg">📱 参加用QRコード</h2>
            <div className="inline-block p-3 bg-white rounded-2xl shadow-inner border-2 border-yellow-200">
              <QRCode
                value={playUrl}
                size={160}
                bgColor="#ffffff"
                fgColor="#1e1b4b"
                level="M"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 break-all">{playUrl}</p>
          </div>

          {/* ルームコード */}
          <div className="pop-card bg-gradient-to-br from-pink-500 to-rose-500 border-pink-700 p-5 text-center">
            <p className="text-pink-100 font-bold text-sm mb-1">ルームコード</p>
            <p className="text-white font-black text-5xl tracking-[0.3em] mb-3">
              {roomCode.toUpperCase()}
            </p>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30
                         text-white font-bold px-4 py-2 rounded-xl transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "コピー済み！" : "コピー"}
            </button>
          </div>

          {/* 回答済み人数 */}
          <div className="pop-card bg-gradient-to-br from-cyan-500 to-blue-600 border-cyan-700 p-5 text-center">
            <p className="text-cyan-100 font-bold text-sm mb-1">回答済み</p>
            <div className="flex items-center justify-center gap-2">
              <Users className="w-7 h-7 text-white" />
              <motion.span
                key={voteCount}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-white font-black text-5xl tabular-nums"
              >
                {voteCount}
              </motion.span>
              <span className="text-cyan-100 font-bold text-xl">人</span>
            </div>
          </div>
        </div>

        {/* ─── 中央・右カラム: メイン操作 ─── */}
        <div className="lg:col-span-2 space-y-5">

          {/* お題フォーム */}
          <div className="pop-card bg-white border-purple-300 p-6">
            <h2 className="font-black text-gray-700 text-xl mb-4 flex items-center gap-2">
              <Mic2 className="w-6 h-6 text-purple-500" />
              お題を設定する
            </h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isVoting || isRevealing}
                placeholder="例：好きな人がいる？"
                onKeyDown={(e) => e.key === "Enter" && handleStartVoting()}
                className="flex-1 text-lg font-bold px-4 py-3 rounded-2xl
                           border-2 border-purple-200 focus:border-purple-500
                           focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
              />
              <motion.button
                whileTap={{ scale: 0.95, y: 2 }}
                onClick={handleStartVoting}
                disabled={!question.trim() || isVoting || isRevealing}
                className="btn-3d px-6 py-3 text-white text-lg font-black
                           bg-gradient-to-r from-purple-500 to-pink-500
                           disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ boxShadow: "0 6px 0 #7e22ce" }}
              >
                <Play className="inline-block w-5 h-5 mr-1" />
                開始
              </motion.button>
            </div>
            {error && <p className="text-red-500 font-bold text-sm mt-2">⚠️ {error}</p>}
          </div>

          {/* 現在のお題バナー */}
          <AnimatePresence>
            {(isVoting || isRevealed) && room.current_question && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="pop-card bg-gradient-to-r from-yellow-400 to-orange-400 border-yellow-600 p-6 text-center"
              >
                <p className="text-yellow-900 font-bold text-sm mb-1">📢 現在のお題</p>
                <p className="text-2xl md:text-3xl font-black text-white"
                  style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.2)" }}>
                  {room.current_question}
                </p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold
                    ${isVoting ? "bg-green-500 text-white" : "bg-white/40 text-yellow-900"}`}>
                    {isVoting ? (
                      <><span className="w-2 h-2 bg-white rounded-full animate-pulse inline-block" />投票受付中</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" />結果発表済み</>
                    )}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 結果発表・リセットボタン */}
          <div className="grid grid-cols-2 gap-4">
            <motion.button
              whileTap={{ scale: 0.97, y: 3 }}
              onClick={handleReveal}
              disabled={!isVoting || isRevealing || voteCount === 0}
              className={`btn-3d py-5 text-white text-xl font-black
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isRevealing
                  ? "bg-orange-500"
                  : "bg-gradient-to-r from-orange-500 to-red-500"
                }`}
              style={{ boxShadow: "0 7px 0 #c2410c" }}
            >
              {isRevealing ? (
                <span className="animate-pulse">🥁 ドラムロール中...</span>
              ) : (
                <><Eye className="inline-block w-6 h-6 mr-2" />結果発表！</>
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97, y: 3 }}
              onClick={handleReset}
              className="btn-3d py-5 text-white text-xl font-black
                         bg-gradient-to-r from-gray-500 to-gray-600"
              style={{ boxShadow: "0 7px 0 #374151" }}
            >
              <RotateCcw className="inline-block w-5 h-5 mr-2" />
              リセット
            </motion.button>
          </div>

          {/* ─── 結果パネル ─── */}
          <AnimatePresence>
            {showResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="pop-card bg-gradient-to-br from-indigo-600 to-purple-700
                           border-indigo-400 p-6 text-center relative overflow-hidden"
              >
                {/* キラキラ */}
                {["⭐","✨","🌟","💫","🎊","🎉","🌈","💖"].map((em, i) => (
                  <motion.div
                    key={i}
                    className="absolute text-2xl select-none pointer-events-none"
                    style={{ left: `${10 + i * 12}%`, top: "-10%" }}
                    animate={{ y: ["0%", "120%"], opacity: [1, 0] }}
                    transition={{ duration: 2 + Math.random(), delay: i * 0.15, repeat: Infinity, repeatDelay: 1 }}
                  >
                    {em}
                  </motion.div>
                ))}

                <p className="text-white/70 font-bold text-sm mb-2">🏆 投票結果</p>
                <p className="text-white font-black text-xl md:text-2xl mb-6">
                  {room.current_question}
                </p>

                {/* はい / いいえ カード */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-pink-500/30 rounded-2xl p-4 border-2 border-pink-400">
                    <p className="text-pink-200 font-black text-lg">✅ はい</p>
                    <p className="text-white font-black text-6xl tabular-nums">{yesCount}</p>
                    <p className="text-pink-200 font-bold">人</p>
                  </div>
                  <div className="bg-blue-500/30 rounded-2xl p-4 border-2 border-blue-400">
                    <p className="text-blue-200 font-black text-lg">❌ いいえ</p>
                    <p className="text-white font-black text-6xl tabular-nums">{noCount}</p>
                    <p className="text-blue-200 font-bold">人</p>
                  </div>
                </div>

                {/* パーセントバー */}
                <div className="mb-6">
                  <p className="text-white/60 text-sm font-bold mb-2">合計 {totalCount} 人中</p>
                  <div className="w-full h-8 bg-white/10 rounded-full overflow-hidden flex">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${yesPercent}%` }}
                      transition={{ duration: 1.4, delay: 0.3, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-pink-400 to-rose-500 flex items-center justify-center"
                    >
                      {yesPercent > 15 && (
                        <span className="text-white text-xs font-black">{yesPercent}%</span>
                      )}
                    </motion.div>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${100 - yesPercent}%` }}
                      transition={{ duration: 1.4, delay: 0.3, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-blue-400 to-cyan-500 flex items-center justify-center"
                    >
                      {(100 - yesPercent) > 15 && (
                        <span className="text-white text-xs font-black">{100 - yesPercent}%</span>
                      )}
                    </motion.div>
                  </div>
                  <div className="flex justify-between text-xs font-bold mt-1">
                    <span className="text-pink-300">はい {yesPercent}%</span>
                    <span className="text-blue-300">いいえ {100 - yesPercent}%</span>
                  </div>
                </div>

                {/* 次のお題へ */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleReset}
                  className="btn-3d w-full py-4 text-white font-black text-lg
                             bg-gradient-to-r from-green-500 to-emerald-500"
                  style={{ boxShadow: "0 6px 0 #166534" }}
                >
                  <RefreshCw className="inline-block w-5 h-5 mr-2" />
                  次のお題へ
                  <ChevronRight className="inline-block w-5 h-5 ml-1" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </main>
  );
}
