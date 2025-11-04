// src/App.tsx
import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";

import BackgroundRenderer from "./components/BackgroundRenderer";
import { FpsBadge, PeopleChip, CameraPreview, Hamburger } from "./components/Overlays";
import ConfigModal from "./components/ConfigModal";

// ===== Types & constants =====
type ResKey = "360p" | "540p" | "720p" | "1080p";
const RESOLUTIONS: Record<ResKey, { w: number; h: number; label: string }> = {
  "360p": { w: 640, h: 360, label: "640×360 (360p)" },
  "540p": { w: 960, h: 540, label: "960×540 (540p)" },
  "720p": { w: 1280, h: 720, label: "1280×720 (720p)" },
  "1080p": { w: 1920, h: 1080, label: "1920×1080 (1080p)" }
};

type BgType = "none" | "gradient" | "video" | "gif" | "particles" | "tunnel" | "vaporwave";
type VideoKey = "mdn-flower" | "bbb";
type GifKey = "giphy-1" | "giphy-2";

const BG_VIDEOS: Record<VideoKey, { label: string; url: string }> = {
  "mdn-flower": {
    label: "Flowers (MDN, 720p)",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
  },
  bbb: {
    label: "Big Buck Bunny (Trailer, CC)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
  }
};
const BG_GIFS: Record<GifKey, { label: string; url: string }> = {
  "giphy-1": {
    label: "Giphy: Ig3z7O77…",
    url: "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXRpamU1YW95ZGQwdWl6eGw3Z2FnMGczaXZwc2d2Y3d2ZTh2anA1NiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Ig3z7O77TOo67qMGI6/giphy.gif"
  },
  "giphy-2": {
    label: "Giphy: 4JaNPT2r…",
    url: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGxsZms1cjJ3dmdxMjEzMW14dzJnN2dwcmV6ZWNyYmpsemI4Y2pnbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/4JaNPT2rDoOcYpt2L3/giphy.gif"
  }
};

// ===== LocalStorage =====
const STORAGE_KEY = "boothConfig_v5";
function readPersisted<T>(defaults: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const cur = JSON.parse(raw);
    return { ...defaults, ...cur };
  } catch {
    return defaults;
  }
}
function writePersisted(data: any) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// ===== MediaPipe =====
const MEDIAPIPE_VER = "0.10.14";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VER}/wasm`;
const POSE_TASK_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

// ===== Music engine =====
type InstrumentId =
  | "kick"
  | "piano"
  | "hihat"
  | "bass"
  | "pad"
  | "lead"
  | "perc"
  | "pluck"
  | "fx"
  | "snare";

const ORDER: InstrumentId[] = [
  "kick", "piano", "hihat", "bass", "pad", "lead", "perc", "pluck", "fx", "snare"
];

class MusicEngine {
  transport = Tone.Transport;
  master = new Tone.Gain(0.9);
  comp = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.003, release: 0.25 });
  limit = new Tone.Limiter(-1);
  analyser = new Tone.Analyser("fft", 512);

  gains: Record<InstrumentId, Tone.Gain> = {
    kick: new Tone.Gain(0),
    piano: new Tone.Gain(0),
    hihat: new Tone.Gain(0),
    bass: new Tone.Gain(0),
    pad: new Tone.Gain(0),
    lead: new Tone.Gain(0),
    perc: new Tone.Gain(0),
    pluck: new Tone.Gain(0),
    fx: new Tone.Gain(0),
    snare: new Tone.Gain(0)
  };

  kick = new Tone.MembraneSynth({ octaves: 4, pitchDecay: 0.01, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } });
  snare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.22, sustain: 0 } });
  hihatNoise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.06, sustain: 0 } });
  hihatHP = new Tone.Filter({ type: "highpass", frequency: 8000, rolloff: -24 });
  drumRoom = new Tone.Reverb({ decay: 1.2, wet: 0.25 });

  bass = new Tone.MonoSynth({
    oscillator: { type: "square" },
    filter: { Q: 1, type: "lowpass", rolloff: -24 },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2 },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2, baseFrequency: 60, octaves: 3 }
  });
  piano = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.2, release: 0.4 } });
  pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.6, decay: 0.3, sustain: 0.6, release: 1.5 } });
  padRev = new Tone.Reverb({ decay: 4, wet: 0.4 });
  lead = new Tone.MonoSynth({ oscillator: { type: "sawtooth" }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.2 } });
  percNoise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } });
  percHP = new Tone.Filter({ type: "highpass", frequency: 9000, rolloff: -24 });
  pluck = new Tone.MonoSynth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.05 } });
  fxNoise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.02, decay: 1.2, sustain: 0, release: 0.4 } });
  fxLP = new Tone.Filter({ type: "lowpass", frequency: 300, rolloff: -12 });

  loopKick!: Tone.Loop; loopSnare!: Tone.Loop; loopHat!: Tone.Loop; loopBass!: Tone.Loop;
  loopPiano!: Tone.Loop; loopPad!: Tone.Loop; loopLead!: Tone.Loop; loopPerc!: Tone.Loop; loopPluck!: Tone.Loop; loopFx!: Tone.Loop;

  constructor() {
    this.master.chain(this.comp, this.limit, Tone.getDestination());
    this.limit.connect(this.analyser);
    Object.values(this.gains).forEach((g) => g.connect(this.master));

    this.kick.connect(this.gains.kick);
    this.snare.connect(this.gains.snare); this.snare.connect(this.drumRoom);
    this.hihatNoise.connect(this.hihatHP); this.hihatHP.connect(this.gains.hihat); this.hihatHP.connect(this.drumRoom);
    this.drumRoom.connect(this.master);
    this.bass.connect(this.gains.bass);
    this.piano.connect(this.gains.piano);
    this.pad.connect(this.padRev); this.padRev.connect(this.gains.pad);
    this.lead.connect(this.gains.lead);
    this.percNoise.connect(this.percHP); this.percHP.connect(this.gains.perc);
    this.pluck.connect(this.gains.pluck);
    this.fxNoise.connect(this.fxLP); this.fxLP.connect(this.gains.fx);

    this.transport.bpm.value = 100;

    this.loopKick = new Tone.Loop((time) => { this.kick.triggerAttackRelease("C2", "8n", time); }, "2n").start(0);
    this.loopSnare = new Tone.Loop((time) => { this.snare.triggerAttackRelease("16n", time); }, "2n").start("4n");
    this.loopHat = new Tone.Loop((time) => { this.hihatNoise.triggerAttackRelease("32n", time); }, "8n").start(0);

    const bassLine = ["C2", "C2", "G1", "F1"]; let bi = 0;
    this.loopBass = new Tone.Loop((time) => { this.bass.triggerAttackRelease(bassLine[bi % bassLine.length], "8n", time); bi++; }, "4n").start(0);

    const chord = ["C4", "E4", "G4", "B4"];
    this.loopPiano = new Tone.Loop((time) => { this.piano.triggerAttackRelease(chord, "8n", time); }, "1n").start("8n");

    const padChords: string[][] = [
      ["C4","E4","G4","B4"],
      ["A3","C4","E4","G4"],
      ["F3","A3","C4","E4"],
      ["G3","B3","D4","F4"],
    ]; let pi = 0;
    this.loopPad = new Tone.Loop((time) => { this.pad.triggerAttackRelease(padChords[pi % padChords.length], "1m", time); pi++; }, "1m").start(0);

    const arp = ["C5","D5","E5","G5","B5","G5","E5","D5"]; let li = 0;
    this.loopLead = new Tone.Loop((time) => { this.lead.triggerAttackRelease(arp[li % arp.length], "16n", time); li++; }, "8n").start(0);

    this.loopPerc = new Tone.Loop((time) => { this.percNoise.triggerAttackRelease("64n", time); }, "16n").start(0);

    const pl = ["C4","E4","G4","E4"]; let pi2 = 0;
    this.loopPluck = new Tone.Loop((time) => { this.pluck.triggerAttackRelease(pl[pi2 % pl.length], "16n", time); pi2++; }, "16n").start("8n");

    this.loopFx = new Tone.Loop((time) => {
      this.fxLP.frequency.cancelScheduledValues(time);
      this.fxLP.frequency.setValueAtTime(300, time);
      this.fxLP.frequency.rampTo(8000, 1.6, time);
      this.fxNoise.triggerAttackRelease("2n", time);
    }, "2m").start(0);
  }

  async ensureStarted() {
    if (Tone.getContext().state !== "running") {
      await Tone.start().catch(() => {});
    }
    if (this.transport.state !== "started") {
      this.transport.start("+0.02");
    }
  }
  fade(id: InstrumentId, target: number, dur = 0.35) {
    this.gains[id].gain.rampTo(target, dur);
  }
}

// ===== People counter =====
class PeopleCounter {
  video: HTMLVideoElement;
  landmarker?: PoseLandmarker;
  running = false;
  onCount?: (n: number) => void;
  private window: number[] = [];
  private size = 7;
  private rafId: number | null = null;
  private last = 0;
  private frameInterval = 1000 / 60;
  constructor(video: HTMLVideoElement) { this.video = video; }
  async init() {
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_TASK_URL },
      runningMode: "VIDEO",
      numPoses: 10,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45
    });
  }
  setFps(target: number) { this.frameInterval = 1000 / Math.max(1, target); }
  async start(targetFps = 60) {
    if (!this.landmarker) await this.init();
    if (this.running) return;
    this.running = true;
    this.setFps(targetFps);
    this.last = 0;

    const detect = (ts: number) => {
      const res = this.landmarker!.detectForVideo(this.video, ts) as PoseLandmarkerResult;
      const raw = (res as any)?.landmarks?.length ?? (res as any)?.poseLandmarks?.length ?? 0;
      this.window.push(raw);
      if (this.window.length > this.size) this.window.shift();
      const sorted = [...this.window].sort((a,b)=>a-b);
      const smooth = sorted[Math.floor(sorted.length/2)];
      this.onCount?.(smooth);
    };

    const step = (now: number) => {
      if (!this.running || this.video.readyState < 2) return schedule();
      if (now - this.last >= this.frameInterval) { this.last = now; detect(now); }
      schedule();
    };
    const schedule = () => {
      const v: any = this.video;
      if (typeof v.requestVideoFrameCallback === "function") v.requestVideoFrameCallback(step);
      else this.rafId = requestAnimationFrame((t) => step(t));
    };
    schedule();
  }
  stop() { this.running = false; if (this.rafId != null) cancelAnimationFrame(this.rafId); this.rafId = null; }
}

// ===== Defaults (persisted) =====
const DEFAULTS = {
  showCam: true, showFps: true, showPeople: true,
  bpm: 100, masterVol: 90,
  detectTargetFps: 60, barsCount: 84, barMaxPct: 75,
  selectedDeviceId: "default" as const, selectedRes: "720p" as ResKey,
  bgType: "gradient" as BgType, bgVideoKey: "mdn-flower" as VideoKey, bgGifKey: "giphy-1" as GifKey,
  bgCustomUrl: "", bgBlur: 0, bgDim: 20,
  tunnelSpeed: 1.0, tunnelSwirl: 3.0, tunnelDensity: 12.0, tunnelQuality: 1.0,
  barColorLow: "#22c55e", barColorHigh:"#ef4444",
  tunnelColorLow:"#22c55e", tunnelColorHigh:"#ef4444",
  vaporSpeed: 0.8, vaporQuality: 1.0,
  vaporGridColor: "#7dffea",
  vaporSkyTop: "#1b1645",
  vaporSkyBottom: "#af248e",
  vaporSkySolid: "#0b1220",
  vaporSkyMix: 0.0,
  vaporSunInner: "#ffd1a8",
  vaporSunOuter: "#ff5e86",
  vaporSunHeight: 0.675,
  vaporSunRadius: 0.35
};

export default function App() {
  const persisted = readPersisted(DEFAULTS);

  const [showCam, setShowCam] = useState<boolean>(persisted.showCam);
  const [showFps, setShowFps] = useState<boolean>(persisted.showFps);
  const [showPeople, setShowPeople] = useState<boolean>(persisted.showPeople);

  const [bpm, setBpm] = useState<number>(persisted.bpm);
  const [masterVol, setMasterVol] = useState<number>(persisted.masterVol);

  const [detectTargetFps, setDetectTargetFps] = useState<number>(persisted.detectTargetFps);
  const [barsCount, setBarsCount] = useState<number>(persisted.barsCount);
  const [barMaxPct, setBarMaxPct] = useState<number>(persisted.barMaxPct);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | "default">(persisted.selectedDeviceId);
  const [selectedRes, setSelectedRes] = useState<ResKey>(persisted.selectedRes);

  const [bgType, setBgType] = useState<BgType>(persisted.bgType);
  const [bgVideoKey, setBgVideoKey] = useState<VideoKey>(persisted.bgVideoKey);
  const [bgGifKey, setBgGifKey] = useState<GifKey>(persisted.bgGifKey);
  const [bgCustomUrl, setBgCustomUrl] = useState<string>(persisted.bgCustomUrl);
  const [bgBlur, setBgBlur] = useState<number>(persisted.bgBlur);
  const [bgDim, setBgDim] = useState<number>(persisted.bgDim);

  const [tunnelSpeed, setTunnelSpeed] = useState<number>(persisted.tunnelSpeed);
  const [tunnelSwirl, setTunnelSwirl] = useState<number>(persisted.tunnelSwirl);
  const [tunnelDensity, setTunnelDensity] = useState<number>(persisted.tunnelDensity);
  const [tunnelQuality, setTunnelQuality] = useState<number>(persisted.tunnelQuality);

  const [barColorLow, setBarColorLow] = useState<string>(persisted.barColorLow);
  const [barColorHigh, setBarColorHigh] = useState<string>(persisted.barColorHigh);
  const [tunnelColorLow, setTunnelColorLow] = useState<string>(persisted.tunnelColorLow);
  const [tunnelColorHigh, setTunnelColorHigh] = useState<string>(persisted.tunnelColorHigh);

  const [vaporSpeed, setVaporSpeed] = useState<number>(persisted.vaporSpeed);
  const [vaporQuality, setVaporQuality] = useState<number>(persisted.vaporQuality);
  const [vaporGridColor, setVaporGridColor] = useState<string>(persisted.vaporGridColor);
  const [vaporSkyTop, setVaporSkyTop] = useState<string>(persisted.vaporSkyTop);
  const [vaporSkyBottom, setVaporSkyBottom] = useState<string>(persisted.vaporSkyBottom);
  const [vaporSkySolid, setVaporSkySolid] = useState<string>(persisted.vaporSkySolid);
  const [vaporSkyMix, setVaporSkyMix] = useState<number>(persisted.vaporSkyMix);
  const [vaporSunInner, setVaporSunInner] = useState<string>(persisted.vaporSunInner);
  const [vaporSunOuter, setVaporSunOuter] = useState<string>(persisted.vaporSunOuter);
  const [vaporSunHeight, setVaporSunHeight] = useState<number>(persisted.vaporSunHeight);
  const [vaporSunRadius, setVaporSunRadius] = useState<number>(persisted.vaporSunRadius);

  const [people, setPeople] = useState(0);
  const [openConfig, setOpenConfig] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [renderFps, setRenderFps] = useState(0);

  // ONE source of truth for the webcam element. Keep it rendered always (visibility via CSS).
  const videoRef = useRef<HTMLVideoElement>(null);

  const engineRef = useRef<MusicEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastRenderTS = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pcInstanceRef = useRef<PeopleCounter | null>(null);

  const activeRef = useRef<InstrumentId[]>([]);
  const barsCountRef = useRef(barsCount);
  const barMaxPctRef = useRef(barMaxPct);
  const barLowColRef = useRef(barColorLow);
  const barHighColRef = useRef(barColorHigh);
  useEffect(() => { barsCountRef.current = barsCount; }, [barsCount]);
  useEffect(() => { barMaxPctRef.current = barMaxPct; }, [barMaxPct]);
  useEffect(() => { barLowColRef.current = barColorLow; }, [barColorLow]);
  useEffect(() => { barHighColRef.current = barColorHigh; }, [barColorHigh]);

  // persist
  useEffect(() => {
    writePersisted({
      showCam, showFps, showPeople,
      bpm, masterVol,
      detectTargetFps, barsCount, barMaxPct,
      selectedDeviceId, selectedRes,
      bgType, bgVideoKey, bgGifKey, bgCustomUrl, bgBlur, bgDim,
      tunnelSpeed, tunnelSwirl, tunnelDensity, tunnelQuality,
      barColorLow, barColorHigh, tunnelColorLow, tunnelColorHigh,
      vaporSpeed, vaporQuality, vaporGridColor, vaporSkyTop, vaporSkyBottom, vaporSkySolid, vaporSkyMix,
      vaporSunInner, vaporSunOuter, vaporSunHeight, vaporSunRadius
    });
  }, [
    showCam, showFps, showPeople,
    bpm, masterVol,
    detectTargetFps, barsCount, barMaxPct,
    selectedDeviceId, selectedRes,
    bgType, bgVideoKey, bgGifKey, bgCustomUrl, bgBlur, bgDim,
    tunnelSpeed, tunnelSwirl, tunnelDensity, tunnelQuality,
    barColorLow, barColorHigh, tunnelColorLow, tunnelColorHigh,
    vaporSpeed, vaporQuality, vaporGridColor, vaporSkyTop, vaporSkyBottom, vaporSkySolid, vaporSkyMix,
    vaporSunInner, vaporSunOuter, vaporSunHeight, vaporSunRadius
  ]);

  // camera start
  const startStream = async (deviceId?: string | "default", resKey?: ResKey) => {
    const videoEl = videoRef.current!;
    const prev = videoEl?.srcObject as MediaStream | null;
    if (prev) prev.getTracks().forEach((t) => t.stop());

    const key = resKey || selectedRes;
    const { w, h } = RESOLUTIONS[key];

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        width: { ideal: w }, height: { ideal: h },
        frameRate: { ideal: 60, max: 60 },
        ...(deviceId && deviceId !== "default" ? { deviceId: { exact: deviceId } } : { facingMode: "user" })
      }
    };

    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia(constraints); }
    catch { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }

    videoEl.srcObject = stream;
    try { await videoEl.play(); } catch {}

    const devs = await navigator.mediaDevices.enumerateDevices();
    const cams = devs.filter((d) => d.kind === "videoinput");
    setCameras(cams);
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    const currentDeviceId = settings.deviceId || cams[0]?.deviceId || "default";
    setSelectedDeviceId(currentDeviceId);
  };

  // boot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await startStream(selectedDeviceId, selectedRes);
      if (cancelled) return;

      const engine = new MusicEngine();
      engineRef.current = engine;

      const unlock = async () => { await engine.ensureStarted(); };
      ["pointerdown","keydown","touchstart","mousemove","visibilitychange"].forEach(ev =>
        document.addEventListener(ev, unlock, { passive:true, capture:true })
      );
      engine.ensureStarted();

      const cvs = canvasRef.current!;
      const ctx = cvs.getContext("2d")!;
      const draw = (ts: number) => {
        if (!engineRef.current) { rafIdRef.current = requestAnimationFrame(draw); return; }
        if (lastRenderTS.current != null) {
          const dt = ts - lastRenderTS.current;
          const rawFps = dt > 0 ? 1000 / dt : 0;
          const clamped = Math.min(Math.max(rawFps, 0), 240);
          setRenderFps((p) => (p ? p * 0.85 + clamped * 0.15 : clamped));
        }
        lastRenderTS.current = ts;

        const analyser = engineRef.current.analyser;
        const values = analyser.getValue() as Float32Array;
        renderBars(values, cvs, ctx, barsCountRef.current, barMaxPctRef.current, barLowColRef.current, barHighColRef.current);

        rafIdRef.current = requestAnimationFrame(draw);
      };
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(draw);

      const videoEl = videoRef.current!;
      const pc = new PeopleCounter(videoEl);
      pc.onCount = (n: number) => {
        const target = Math.min(10, n);
        setPeople(target);
        applyInstruments(target);
      };
      await pc.start(detectTargetFps);
      pcInstanceRef.current = pc;
    })().catch((e) => {
      console.error("Startup error:", e);
      alert("Startup error: " + (e?.message || e));
    });

    return () => {
      cancelled = true;
      if (rafIdRef.current != null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
      pcInstanceRef.current?.stop();
      const v = videoRef.current;
      if (v && v.srcObject) { (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop()); v.srcObject = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { pcInstanceRef.current?.stop(); pcInstanceRef.current?.start(detectTargetFps); }, [detectTargetFps]);
  useEffect(() => { engineRef.current?.transport.bpm.rampTo(bpm, 0.3); }, [bpm]);
  useEffect(() => { engineRef.current?.master.gain.rampTo(Math.max(0, Math.min(1, masterVol / 100)), 0.25); }, [masterVol]);

  function applyInstruments(count: number) {
    const engine = engineRef.current!;
    const current = activeRef.current.slice();
    const desired = ORDER.slice(0, count);
    for (const id of desired) {
      if (!current.includes(id)) { current.push(id); engine.fade(id, 1.0, 0.35); }
    }
    while (current.length > desired.length) {
      const removed = current.pop()!; engine.fade(removed, 0.0, 0.35);
    }
    activeRef.current = current;
  }

  const handleChangeCamera = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value; setSelectedDeviceId(id); await startStream(id as string, selectedRes);
  };
  const handleChangeRes = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value as ResKey; setSelectedRes(key); await startStream(selectedDeviceId, key);
  };

  // --- Fix #2 and #3: wrappers so props expecting (v: string) => void tetap cocok
  const setVideoKeyStr = (v: string) => setBgVideoKey(v as VideoKey);
  const setGifKeyStr   = (v: string) => setBgGifKey(v as GifKey);

  const currentVideoUrl = (bgCustomUrl && bgType === "video") ? bgCustomUrl : BG_VIDEOS[bgVideoKey]?.url || null;
  const currentGifUrl   = (bgCustomUrl && bgType === "gif")   ? bgCustomUrl : BG_GIFS[bgGifKey]?.url   || null;

  return (
    <div className="relative h-dvh w-screen overflow-hidden text-white bg-black">
      {/* BACKGROUND */}
      <BackgroundRenderer
        bgType={bgType}
        dimPercent={bgDim}
        blurPx={bgBlur}
        videoUrl={currentVideoUrl}
        gifUrl={currentGifUrl}
        analyser={engineRef.current?.analyser}
        tunnelSpeed={tunnelSpeed}
        tunnelSwirl={tunnelSwirl}
        tunnelDensity={tunnelDensity}
        tunnelQuality={tunnelQuality}
        tunnelColorLow={tunnelColorLow}
        tunnelColorHigh={tunnelColorHigh}
        vaporSpeed={vaporSpeed}
        vaporQuality={vaporQuality}
        vaporGridColor={vaporGridColor}
        vaporSkyTop={vaporSkyTop}
        vaporSkyBottom={vaporSkyBottom}
        vaporSkySolid={vaporSkySolid}
        vaporSkyMix={vaporSkyMix}
        vaporSunInner={vaporSunInner}
        vaporSunOuter={vaporSunOuter}
        vaporSunHeight={vaporSunHeight}
        vaporSunRadius={vaporSunRadius}
      />

      {/* Visualizer bars 2D */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />

      {/* UI overlays */}
      <Hamburger onClick={() => setOpenConfig(true)} />
      <PeopleChip show={showPeople} count={people} />
      {/* Fix #1: cast ref to expected non-nullable type used by the component */}
      <CameraPreview show={showCam} videoRef={videoRef as React.RefObject<HTMLVideoElement>} />
      <FpsBadge show={showFps} value={renderFps} />

      {/* Config */}
      {openConfig && (
        <ConfigModal
          open={openConfig}
          onClose={() => setOpenConfig(false)}
          onReset={async () => {
            try { localStorage.removeItem(STORAGE_KEY); } catch {}
            const d = DEFAULTS;
            setShowCam(d.showCam); setShowFps(d.showFps); setShowPeople(d.showPeople);
            setBpm(d.bpm); setMasterVol(d.masterVol);
            setDetectTargetFps(d.detectTargetFps); setBarsCount(d.barsCount); setBarMaxPct(d.barMaxPct);
            setSelectedDeviceId(d.selectedDeviceId as "default"); setSelectedRes(d.selectedRes);
            setBgType(d.bgType); setBgVideoKey(d.bgVideoKey); setBgGifKey(d.bgGifKey);
            setBgCustomUrl(d.bgCustomUrl); setBgBlur(d.bgBlur); setBgDim(d.bgDim);
            setTunnelSpeed(d.tunnelSpeed); setTunnelSwirl(d.tunnelSwirl); setTunnelDensity(d.tunnelDensity); setTunnelQuality(d.tunnelQuality);
            setBarColorLow(d.barColorLow); setBarColorHigh(d.barColorHigh);
            setTunnelColorLow(d.tunnelColorLow); setTunnelColorHigh(d.tunnelColorHigh);
            setVaporSpeed(d.vaporSpeed); setVaporQuality(d.vaporQuality);
            setVaporGridColor(d.vaporGridColor); setVaporSkyTop(d.vaporSkyTop); setVaporSkyBottom(d.vaporSkyBottom);
            setVaporSkySolid(d.vaporSkySolid); setVaporSkyMix(d.vaporSkyMix);
            setVaporSunInner(d.vaporSunInner); setVaporSunOuter(d.vaporSunOuter);
            setVaporSunHeight(d.vaporSunHeight); setVaporSunRadius(d.vaporSunRadius);
            await startStream("default", "720p");
          }}
          bgType={bgType} setBgType={setBgType}
          bgVideoKey={bgVideoKey} setBgVideoKey={setVideoKeyStr}
          bgGifKey={bgGifKey} setBgGifKey={setGifKeyStr}
          bgCustomUrl={bgCustomUrl} setBgCustomUrl={setBgCustomUrl}
          bgBlur={bgBlur} setBgBlur={setBgBlur}
          bgDim={bgDim} setBgDim={setBgDim}
          videos={BG_VIDEOS} gifs={BG_GIFS}
          tunnelSpeed={tunnelSpeed} setTunnelSpeed={setTunnelSpeed}
          tunnelSwirl={tunnelSwirl} setTunnelSwirl={setTunnelSwirl}
          tunnelDensity={tunnelDensity} setTunnelDensity={setTunnelDensity}
          tunnelQuality={tunnelQuality} setTunnelQuality={setTunnelQuality}
          tunnelColorLow={tunnelColorLow} setTunnelColorLow={setTunnelColorLow}
          tunnelColorHigh={tunnelColorHigh} setTunnelColorHigh={setTunnelColorHigh}
          vaporSpeed={vaporSpeed} setVaporSpeed={setVaporSpeed}
          vaporQuality={vaporQuality} setVaporQuality={setVaporQuality}
          vaporGridColor={vaporGridColor} setVaporGridColor={setVaporGridColor}
          vaporSkyTop={vaporSkyTop} setVaporSkyTop={setVaporSkyTop}
          vaporSkyBottom={vaporSkyBottom} setVaporSkyBottom={setVaporSkyBottom}
          vaporSkySolid={vaporSkySolid} setVaporSkySolid={setVaporSkySolid}
          vaporSkyMix={vaporSkyMix} setVaporSkyMix={setVaporSkyMix}
          vaporSunInner={vaporSunInner} setVaporSunInner={setVaporSunInner}
          vaporSunOuter={vaporSunOuter} setVaporSunOuter={setVaporSunOuter}
          vaporSunHeight={vaporSunHeight} setVaporSunHeight={setVaporSunHeight}
          vaporSunRadius={vaporSunRadius} setVaporSunRadius={setVaporSunRadius}
          detectTargetFps={detectTargetFps} setDetectTargetFps={setDetectTargetFps}
          barsCount={barsCount} setBarsCount={setBarsCount}
          barMaxPct={barMaxPct} setBarMaxPct={setBarMaxPct}
          barColorLow={barColorLow} setBarColorLow={setBarColorLow}
          barColorHigh={barColorHigh} setBarColorHigh={setBarColorHigh}
          cameras={cameras} selectedDeviceId={selectedDeviceId}
          setSelectedDeviceId={setSelectedDeviceId}
          onChangeCamera={handleChangeCamera}
          selectedRes={selectedRes} onChangeRes={handleChangeRes}
          showCam={showCam} setShowCam={setShowCam}
          showFps={showFps} setShowFps={setShowFps}
          showPeople={showPeople} setShowPeople={setShowPeople}
        />
      )}
    </div>
  );
}

// simple bar renderer
function renderBars(
  values: Float32Array,
  cvs: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  bars: number,
  maxPct: number,
  lowHex: string,
  highHex: string
) {
  const w = cvs.clientWidth, h = cvs.clientHeight;
  if (cvs.width !== w || cvs.height !== h) { cvs.width = w; cvs.height = h; }
  ctx.clearRect(0,0,w,h);

  const barsClamped = Math.max(20, Math.min(200, bars));
  const step = Math.max(1, Math.floor(values.length / barsClamped));
  const barW = (w / barsClamped) * 0.8;
  const maxH = h * (Math.max(10, Math.min(100, maxPct)) / 100);

  const lc = hexToRgb(lowHex); const hc = hexToRgb(highHex);

  for (let i = 0; i < barsClamped; i++) {
    const db = values[i * step];
    const vRaw = Math.max(0, (db + 100) / 100);
    const v = Math.pow(vRaw, 0.85);
    const bh = Math.max(2, v * maxH);
    const x = i * (w / barsClamped) + (w / barsClamped - barW) / 2;
    const y = h - bh;

    const r = Math.round(lerp(lc.r, hc.r, v));
    const g = Math.round(lerp(lc.g, hc.g, v));
    const b = Math.round(lerp(lc.b, hc.b, v));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, barW, bh);
  }
}
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const b = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (b >> 16) & 255, g: (b >> 8) & 255, b: b & 255 };
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
