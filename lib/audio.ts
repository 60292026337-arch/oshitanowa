/**
 * Web Audio API 効果音ヘルパー
 * 外部ファイル不要 — すべてリアルタイム合成
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function createGain(ctx: AudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

// ─────────────────────────────────────────────
// 1. ドラムロール（SE114.mp3 を再生）
// ─────────────────────────────────────────────
let drumAudio: HTMLAudioElement | null = null;

export function playDrumRoll(_duration = 3.0): void {
  stopDrumRoll();
  drumAudio = new Audio("/SE114.mp3");
  drumAudio.loop = false;
  drumAudio.play().catch(() => { /* autoplay policy などで再生できない場合は無視 */ });
}

export function stopDrumRoll(): void {
  if (drumAudio) {
    drumAudio.pause();
    drumAudio.currentTime = 0;
    drumAudio = null;
  }
}

// ─────────────────────────────────────────────
// 2. シンバル「ジャン！」
// ─────────────────────────────────────────────
export function playCymbal(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // ── ホワイトノイズ（シンバル本体）──
  const cymLen = ctx.sampleRate * 1.5;
  const cymBuf = ctx.createBuffer(1, cymLen, ctx.sampleRate);
  const cd = cymBuf.getChannelData(0);
  for (let i = 0; i < cymLen; i++) cd[i] = Math.random() * 2 - 1;

  const cymSrc = ctx.createBufferSource();
  cymSrc.buffer = cymBuf;

  const hpf = ctx.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = 6000;
  hpf.Q.value = 0.5;

  const cymGain = createGain(ctx, 0);
  cymGain.gain.setValueAtTime(0.001, now);
  cymGain.gain.exponentialRampToValueAtTime(0.8, now + 0.01);
  cymGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

  cymSrc.connect(hpf);
  hpf.connect(cymGain);
  cymGain.connect(ctx.destination);
  cymSrc.start(now);
  cymSrc.stop(now + 1.5);

  // ── オシレーター（胴鳴り）──
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);

  const oscG = createGain(ctx, 0);
  oscG.gain.setValueAtTime(0.001, now);
  oscG.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
  oscG.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = 1200;

  osc.connect(lpf);
  lpf.connect(oscG);
  oscG.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.5);

  // ── キック（低い「ドン」）──
  const kick = ctx.createOscillator();
  kick.type = "sine";
  kick.frequency.setValueAtTime(160, now);
  kick.frequency.exponentialRampToValueAtTime(40, now + 0.15);

  const kickG = createGain(ctx, 0);
  kickG.gain.setValueAtTime(0.001, now);
  kickG.gain.exponentialRampToValueAtTime(Math.pow(10, -3 / 20), now + 0.005);
  kickG.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  kick.connect(kickG);
  kickG.connect(ctx.destination);
  kick.start(now);
  kick.stop(now + 0.3);
}

// ─────────────────────────────────────────────
// 3. 投票ポップ音
// ─────────────────────────────────────────────
export function playVoteSound(choice: boolean): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(choice ? 880 : 440, now);
  osc.frequency.exponentialRampToValueAtTime(choice ? 1320 : 330, now + 0.1);

  const gain = createGain(ctx, 0);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

// ─────────────────────────────────────────────
// 4. ティック音（コピー確認など短い UI 音）
// ─────────────────────────────────────────────
export function playTickSound(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(1200, now);

  const gain = createGain(ctx, 0);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.06);
}
