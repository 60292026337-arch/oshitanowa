"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mic2, Users, ArrowRight, Star, Zap, Heart } from "lucide-react";
import { createRoom, getRoomByCode } from "@/lib/rooms";

const FLOATERS = [
  { emoji: "🎉", x: "8%",  y: "12%", delay: 0,   size: "text-4xl" },
  { emoji: "⭐", x: "88%", y: "8%",  delay: 0.3, size: "text-3xl" },
  { emoji: "🎊", x: "5%",  y: "75%", delay: 0.6, size: "text-3xl" },
  { emoji: "🌟", x: "92%", y: "70%", delay: 0.9, size: "text-4xl" },
  { emoji: "🎈", x: "50%", y: "5%",  delay: 1.2, size: "text-3xl" },
  { emoji: "✨", x: "20%", y: "88%", delay: 0.5, size: "text-2xl" },
  { emoji: "🔥", x: "78%", y: "85%", delay: 0.8, size: "text-2xl" },
];

export default function TopPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"top" | "join">("top");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleCreateRoom() {
    setIsLoading(true);
    setError("");
    try {
      const room = await createRoom();
      router.push(`/host/${room.room_code}`);
    } catch (e) {
      console.error("createRoom error:", e);
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setError(`部屋の作成に失敗しました: ${msg}`);
      setIsLoading(false);
    }
  }

  async function handleJoinRoom() {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 4) {
      setError("4桁のルームコードを入力してください");
      inputRef.current?.focus();
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const room = await getRoomByCode(code);
      if (!room) {
        setError("その部屋は見つかりませんでした。コードを確認してください。");
        setIsLoading(false);
        return;
      }
      router.push(`/play/${room.room_code}`);
    } catch (e) {
      console.error(e);
      setError("接続エラーが発生しました。もう一度お試しください。");
      setIsLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-pink-400 via-purple-500 to-cyan-500 opacity-20 -z-10" />

      {FLOATERS.map((f, i) => (
        <motion.div
          key={i}
          className={`absolute ${f.size} select-none pointer-events-none`}
          style={{ left: f.x, top: f.y }}
          animate={{ y: ["0px", "-18px", "0px"], rotate: [-5, 5, -5] }}
          transition={{ duration: 3 + i * 0.4, delay: f.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          {f.emoji}
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
        className="w-full max-w-md"
      >
        {/* タイトル */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [-3, 3, -3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="text-6xl mb-3"
          >
            🗳️
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">
            <span className="rainbow-text">押したのは</span>
            <br />
            <span className="text-gray-800">誰だ！？</span>
          </h1>
          <p className="text-gray-600 font-bold mt-2">
            みんなで匿名リアルタイム投票 🎊
          </p>
        </div>

        <AnimatePresence mode="wait">
          {mode === "top" ? (
            <motion.div
              key="top"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* ホストボタン */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97, y: 4 }}
                onClick={handleCreateRoom}
                disabled={isLoading}
                className="btn-3d w-full py-6 text-xl text-white bg-gradient-to-r from-pink-500 to-rose-500 disabled:opacity-60"
                style={{ boxShadow: "0 7px 0 #be185d" }}
              >
                <Mic2 className="inline-block mr-3 w-6 h-6" />
                部屋を作る（ホスト）
                <Star className="inline-block ml-3 w-5 h-5 text-yellow-300" />
              </motion.button>

              {/* プレイヤーボタン */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97, y: 4 }}
                onClick={() => {
                  setMode("join");
                  setTimeout(() => inputRef.current?.focus(), 200);
                }}
                className="btn-3d w-full py-6 text-xl text-white bg-gradient-to-r from-cyan-500 to-blue-500"
                style={{ boxShadow: "0 7px 0 #0e7490" }}
              >
                <Users className="inline-block mr-3 w-6 h-6" />
                部屋に入る（プレイヤー）
                <Heart className="inline-block ml-3 w-5 h-5 text-pink-200" />
              </motion.button>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-4"
                >
                  <div className="inline-flex items-center gap-2 text-pink-600 font-bold">
                    <Zap className="w-5 h-5 animate-bounce" />
                    部屋を準備中...
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-red-600 font-bold bg-red-50 rounded-xl p-3 border-2 border-red-200"
                >
                  ⚠️ {error}
                </motion.p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="pop-card bg-white border-cyan-300 p-6 space-y-4"
            >
              <h2 className="text-2xl font-black text-center text-cyan-700">
                🔑 ルームコードを入力
              </h2>

              <input
                ref={inputRef}
                type="text"
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase().slice(0, 4));
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                placeholder="例: AB12"
                maxLength={4}
                className="w-full text-center text-4xl font-black tracking-[0.5em] py-5
                           rounded-2xl border-4 border-cyan-300 focus:border-cyan-500
                           focus:outline-none bg-cyan-50 text-cyan-800 uppercase
                           placeholder:text-cyan-200 placeholder:tracking-normal"
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-600 font-bold text-center text-sm"
                >
                  ⚠️ {error}
                </motion.p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setMode("top"); setError(""); setRoomCode(""); }}
                  className="flex-1 py-4 rounded-2xl border-4 border-gray-300 font-black text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  ← 戻る
                </button>
                <motion.button
                  whileTap={{ scale: 0.97, y: 2 }}
                  onClick={handleJoinRoom}
                  disabled={isLoading || roomCode.length !== 4}
                  className="btn-3d flex-[2] py-4 text-white bg-gradient-to-r from-cyan-500 to-blue-500 text-xl disabled:opacity-50"
                  style={{ boxShadow: "0 6px 0 #0e7490" }}
                >
                  {isLoading ? (
                    <span className="animate-pulse">接続中...</span>
                  ) : (
                    <>
                      入室する
                      <ArrowRight className="inline-block ml-2 w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-gray-400 text-xs mt-8 font-medium">
          投票は完全匿名 · 誰が何を押したか分かりません 🔒
        </p>
      </motion.div>
    </main>
  );
}
