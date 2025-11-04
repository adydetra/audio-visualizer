import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import {
  Scene, PerspectiveCamera, WebGLRenderer, PlaneGeometry,
  Mesh, ShaderMaterial, Vector2, Vector3, Color
} from "three";

/* =========================
   MediaPipe config
========================= */
const MEDIAPIPE_VER = "0.10.14";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VER}/wasm`;
const POSE_TASK_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

/* =========================
   LocalStorage
========================= */
const STORAGE_KEY = "boothConfig_v4";
const LEGACY_KEYS = ["boothConfig_v3", "boothConfig_v2", "boothConfig_v1"];

type ResKey = "360p" | "540p" | "720p" | "1080p";
const RESOLUTIONS: Record<ResKey, { w: number; h: number; label: string }> = {
  "360p":  { w: 640,  h: 360,  label: "640×360 (360p)" },
  "540p":  { w: 960,  h: 540,  label: "960×540 (540p)" },
  "720p":  { w: 1280, h: 720,  label: "1280×720 (720p)" },
  "1080p": { w: 1920, h: 1080, label: "1920×1080 (1080p)" },
};

type BgType = "none" | "gradient" | "video" | "gif" | "particles" | "tunnel" | "vaporwave";
type VideoKey = "mdn-flower" | "bbb";
type GifKey = "giphy-1" | "giphy-2";

const BG_VIDEOS: Record<VideoKey, { label: string; url: string }> = {
  "mdn-flower": {
    label: "Flowers (MDN, 720p)",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  "bbb": {
    label: "Big Buck Bunny (Trailer, CC)",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  },
};

const BG_GIFS: Record<GifKey, { label: string; url: string }> = {
  "giphy-1": {
    label: "Giphy: Ig3z7O77…",
    url: "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXRpamU1YW95ZGQwdWl6eGw3Z2FnMGczaXZwc2d2Y3d2ZTh2anA1NiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Ig3z7O77TOo67qMGI6/giphy.gif",
  },
  "giphy-2": {
    label: "Giphy: 4JaNPT2r…",
    url: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGxsZms1cjJ3dmdxMjEzMW14dzJnN2dwcmV6ZWNyYmpsemI4Y2pnbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/4JaNPT2rDoOcYpt2L3/giphy.gif",
  },
};

type InstrumentId =
  | "kick" | "piano" | "hihat"
  | "bass" | "pad"   | "lead"
  | "perc" | "pluck" | "fx"
  | "snare";

const INSTRUMENT_LABEL: Record<InstrumentId, string> = {
  kick: "Kick",
  snare: "Snare",
  hihat: "Hi-Hat",
  bass: "Bass",
  piano: "Piano",
  pad: "Pad",
  lead: "Lead",
  perc: "Perc",
  pluck: "Pluck",
  fx: "FX",
};

// Urutan aktivasi berdasarkan jumlah people (1..10)
const ORDER: InstrumentId[] = [
  "kick","piano","hihat","bass","pad","lead","perc","pluck","fx","snare"
];

/* =========================
   Defaults & persisted type
========================= */
const DEFAULT_DETECT_FPS = 60;
type Persisted = {
  showCam: boolean; showFps: boolean; showPeople: boolean;
  bpm: number; masterVol: number;
  detectTargetFps: number; barsCount: number; barMaxPct: number;
  selectedDeviceId: string | "default"; selectedRes: ResKey;
  bgType: BgType; bgVideoKey: VideoKey; bgGifKey: GifKey;
  bgCustomUrl: string; bgBlur: number; bgDim: number;
  tunnelSpeed: number; tunnelSwirl: number; tunnelDensity: number; tunnelQuality: number;
  barColorLow: string; barColorHigh: string;
  tunnelColorLow: string; tunnelColorHigh: string;
  vaporSpeed: number; vaporQuality: number;
  vaporGridColor: string; vaporSkyTop: string; vaporSkyBottom: string; vaporSunInner: string; vaporSunOuter: string;
};
const DEFAULTS: Persisted = {
  showCam: true, showFps: true, showPeople: true,
  bpm: 100, masterVol: 90,
  detectTargetFps: DEFAULT_DETECT_FPS, barsCount: 84, barMaxPct: 75,
  selectedDeviceId: "default", selectedRes: "720p",
  bgType: "gradient", bgVideoKey: "mdn-flower", bgGifKey: "giphy-1",
  bgCustomUrl: "", bgBlur: 0, bgDim: 20,
  tunnelSpeed: 1.0, tunnelSwirl: 3.0, tunnelDensity: 12.0, tunnelQuality: 1.0,
  barColorLow: "#22c55e", barColorHigh:"#ef4444",
  tunnelColorLow:"#22c55e", tunnelColorHigh:"#ef4444",
  vaporSpeed: 0.8, vaporQuality: 1.0,
  vaporGridColor: "#7dffea",
  vaporSkyTop: "#1b1645",
  vaporSkyBottom: "#af248e",
  vaporSunInner: "#ffd1a8",
  vaporSunOuter: "#ff5e86",
};

// storage helpers
function readPersisted(): Persisted {
  const safeParse = (raw: string | null) => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const cur = safeParse(localStorage.getItem(STORAGE_KEY));
  if (cur) return { ...DEFAULTS, ...cur };
  for (const k of LEGACY_KEYS) {
    const legacy = safeParse(localStorage.getItem(k));
    if (legacy) return { ...DEFAULTS, ...legacy };
  }
  return { ...DEFAULTS };
}
function writePersisted(data: Persisted) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

/* =========================
   Helpers
========================= */
function hexToRgb(hex: string): { r: number, g: number, b: number } {
  const h = hex.replace("#", "");
  const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

/* =========================
   Tone.js engine
========================= */
class MusicEngine {
  transport = Tone.getTransport();
  master = new Tone.Gain(0.9);
  comp   = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.003, release: 0.25 });
  limit  = new Tone.Limiter(-1);
  analyser = new Tone.Analyser("fft", 512);

  gains: Record<InstrumentId, Tone.Gain> = {
    kick:  new Tone.Gain(0),
    piano: new Tone.Gain(0),
    hihat: new Tone.Gain(0),
    bass:  new Tone.Gain(0),
    pad:   new Tone.Gain(0),
    lead:  new Tone.Gain(0),
    perc:  new Tone.Gain(0),
    pluck: new Tone.Gain(0),
    fx:    new Tone.Gain(0),
    snare: new Tone.Gain(0),
  };

  kick = new Tone.MembraneSynth({
    octaves: 4, pitchDecay: 0.01, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }
  });
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
  piano = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.2, release: 0.4 }
  });
  pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.6, decay: 0.3, sustain: 0.6, release: 1.5 }
  });
  padRev = new Tone.Reverb({ decay: 4, wet: 0.4 });
  lead = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.2, release: 0.2 }
  });
  percNoise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } });
  percHP = new Tone.Filter({ type: "highpass", frequency: 9000, rolloff: -24 });
  pluck = new Tone.MonoSynth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.05 } });
  fxNoise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.02, decay: 1.2, sustain: 0, release: 0.4 } });
  fxLP = new Tone.Filter({ type: "lowpass", frequency: 300, rolloff: -12 });

  // Loops
  loopKick!: Tone.Loop;
  loopSnare!: Tone.Loop;
  loopHat!: Tone.Loop;
  loopBass!: Tone.Loop;
  loopPiano!: Tone.Loop;
  loopPad!: Tone.Loop;
  loopLead!: Tone.Loop;
  loopPerc!: Tone.Loop;
  loopPluck!: Tone.Loop;
  loopFx!: Tone.Loop;

  constructor() {
    this.master.chain(this.comp, this.limit, Tone.getDestination());
    this.limit.connect(this.analyser);
    Object.values(this.gains).forEach(g => g.connect(this.master));

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

    this.loopKick = new Tone.Loop((time) => {
      this.kick.triggerAttackRelease("C2", "8n", time);
    }, "2n").start(0);
    this.loopSnare = new Tone.Loop((time) => {
      this.snare.triggerAttackRelease("16n", time);
    }, "2n").start("4n");
    this.loopHat = new Tone.Loop((time) => {
      this.hihatNoise.triggerAttackRelease("32n", time);
    }, "8n").start(0);

    const bassLine = ["C2", "C2", "G1", "F1"]; let bi = 0;
    this.loopBass = new Tone.Loop((time) => {
      this.bass.triggerAttackRelease(bassLine[bi % bassLine.length], "8n", time); bi++;
    }, "4n").start(0);

    const chord = ["C4", "E4", "G4", "B4"];
    this.loopPiano = new Tone.Loop((time) => {
      this.piano.triggerAttackRelease(chord, "8n", time);
    }, "1n").start("8n");

    const padChords: string[][] = [
      ["C4","E4","G4","B4"],
      ["A3","C4","E4","G4"],
      ["F3","A3","C4","E4"],
      ["G3","B3","D4","F4"],
    ];
    let pi = 0;
    this.loopPad = new Tone.Loop((time) => {
      this.pad.triggerAttackRelease(padChords[pi % padChords.length], "1m", time); pi++;
    }, "1m").start(0);

    const arp = ["C5","D5","E5","G5","B5","G5","E5","D5"]; let li = 0;
    this.loopLead = new Tone.Loop((time) => {
      this.lead.triggerAttackRelease(arp[li % arp.length], "16n", time); li++;
    }, "8n").start(0);

    this.loopPerc = new Tone.Loop((time) => {
      this.percNoise.triggerAttackRelease("64n", time);
    }, "16n").start(0);

    const pl = ["C4","E4","G4","E4"]; let pi2 = 0;
    this.loopPluck = new Tone.Loop((time) => {
      this.pluck.triggerAttackRelease(pl[pi2 % pl.length], "16n", time); pi2++;
    }, "16n").start("8n");

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

/* =========================
   People counter (Pose)
========================= */
class PeopleCounter {
  video: HTMLVideoElement;
  landmarker?: PoseLandmarker;
  running = false;
  onCount?: (n: number) => void;
  private window: number[] = [];
  private size = 7;
  private rafId: number | null = null;
  private last = 0;
  private frameInterval = 1000 / DEFAULT_DETECT_FPS;
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
  setFps(targetFps: number) { this.frameInterval = 1000 / Math.max(1, targetFps); }
  async start(targetFps = DEFAULT_DETECT_FPS) {
    if (!this.landmarker) await this.init();
    if (this.running) return;
    this.running = true;
    this.setFps(targetFps);
    this.last = 0;

    const doDetect = (ts: number) => {
      const res = this.landmarker!.detectForVideo(this.video, ts) as PoseLandmarkerResult;
      const raw =
        (res as any)?.landmarks?.length ??
        (res as any)?.poseLandmarks?.length ??
        0;
      this.window.push(raw);
      if (this.window.length > this.size) this.window.shift();
      const sorted = [...this.window].sort((a,b)=>a-b);
      const smooth = sorted[Math.floor(sorted.length/2)];
      this.onCount?.(smooth);
    };

    const step = (now: number) => {
      if (!this.running || this.video.readyState < 2) return schedule();
      if (now - this.last >= this.frameInterval) {
        this.last = now; doDetect(now);
      }
      schedule();
    };
    const schedule = () => {
      const v = this.video as any;
      if (typeof v.requestVideoFrameCallback === "function") v.requestVideoFrameCallback(step);
      else this.rafId = requestAnimationFrame((t) => step(t));
    };
    schedule();
  }
  stop() {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}

/* =========================
   Audio Tunnel Shader (Three)
========================= */
type TunnelProps = {
  active: boolean;
  analyser: Tone.Analyser | null | undefined;
  speed: number; swirl: number; density: number; quality: number;
  lowColor: string; highColor: string;
};
function AudioTunnel({ active, analyser, speed, swirl, density, quality, lowColor, highColor }: TunnelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);

  useEffect(() => {
    const el = containerRef.current!;
    if (!active) {
      if (rendererRef.current) {
        rendererRef.current.setAnimationLoop(null);
        rendererRef.current.dispose();
        rendererRef.current.domElement.remove();
      }
      rendererRef.current = null; sceneRef.current = null; cameraRef.current = null; materialRef.current = null;
      return;
    }

    const scene = new Scene();
    scene.background = new Color(0x000000);
    const camera = new PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 10);
    camera.position.z = 1;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    const pr = Math.min(window.devicePixelRatio * quality, 2);
    renderer.setPixelRatio(pr); renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const geometry = new PlaneGeometry(2, 2);
    const lc = hexToRgb(lowColor);  const hc = hexToRgb(highColor);
    const material = new ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uResolution:{ value: new Vector2(el.clientWidth, el.clientHeight) },
        uEnergy:    { value: 0 },
        uSpeed:     { value: speed },
        uSwirl:     { value: swirl },
        uDensity:   { value: density },
        uLowColor:  { value: new Vector3(lc.r/255, lc.g/255, lc.b/255) },
        uHighColor: { value: new Vector3(hc.r/255, hc.g/255, hc.b/255) },
      },
      vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position,1.0);}`,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform vec2  uResolution;
        uniform float uTime, uEnergy, uSpeed, uSwirl, uDensity;
        uniform vec3  uLowColor, uHighColor;

        void main(){
          vec2 uv = vUv * 2.0 - 1.0;
          uv.x *= uResolution.x/uResolution.y;
          float r = length(uv)+1e-4;
          float a = atan(uv.y, uv.x);
          float adv = uTime*(0.6+uSpeed*0.8)+uEnergy*2.0;
          float swirl = a*(0.6+uSwirl*0.2+uEnergy*1.2);
          float dens = 6.0 + uDensity;

          float stripes = sin(log(r)*dens*2.0 - adv*2.0 + swirl);
          float wall = smoothstep(0.0, 0.1+0.2*uEnergy, abs(stripes));
          float flow = 0.5 + 0.5*sin(adv + a*4.0 + r*12.0);

          float t = clamp(mix(0.2, 1.0, flow*(0.5+0.5*uEnergy)),0.0,1.0);
          vec3 col = mix(uLowColor, uHighColor, t);

          float vign = smoothstep(1.2, 0.2, r);
          float center = 0.4 * smoothstep(0.22, 0.0, r) * (0.6 + 0.6*uEnergy);
          vec3 color = col * vign * (0.7 + 0.3*wall) + center * vec3(1.0,0.95,0.85);
          gl_FragColor = vec4(color,1.0);
        }
      `,
    });
    const quad = new Mesh(geometry, material);
    scene.add(quad);

    const onResize = () => {
      if (!renderer || !camera || !material) return;
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w,h);
      camera.aspect = w/h; camera.updateProjectionMatrix();
      (material.uniforms.uResolution.value as Vector2).set(w,h);
    };
    const ro = new ResizeObserver(onResize); ro.observe(el);

    let start = performance.now();
    renderer.setAnimationLoop(() => {
      const t = (performance.now()-start)/1000;
      (material.uniforms.uTime.value as number) = t;

      if (analyser) {
        const arr = analyser.getValue() as Float32Array;
        let sum = 0; let n = 0;
        const len = Math.min(arr.length, 512);
        for (let i = 0; i < len; i += 4) { sum += arr[i]; n++; }
        const db = sum / Math.max(n, 1);
        const v = Math.min(1, Math.max(0, (db + 100) / 100));
        const prev = material.uniforms.uEnergy.value as number;
        material.uniforms.uEnergy.value = prev * 0.85 + v * 0.15;
      }

      material.uniforms.uSpeed.value = speed;
      material.uniforms.uSwirl.value = swirl;
      material.uniforms.uDensity.value = density;
      renderer.render(scene,camera);
    });

    // refs
    sceneRef.current = scene; cameraRef.current = camera; rendererRef.current = renderer; materialRef.current = material;

    return () => {
      ro.disconnect();
      renderer.setAnimationLoop(null);
      geometry.dispose(); material.dispose(); renderer.dispose();
      if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
      scene.clear();
    };
  }, [active, analyser, speed, swirl, density, quality, lowColor, highColor]);

  useEffect(() => {
    const r = rendererRef.current; if (!r) return;
    const pr = Math.min(window.devicePixelRatio * quality, 2);
    r.setPixelRatio(pr);
  }, [quality]);

  useEffect(() => {
    const mat = materialRef.current; if (!mat) return;
    const lc = hexToRgb(lowColor); const hc = hexToRgb(highColor);
    (mat.uniforms.uLowColor.value as Vector3).set(lc.r/255, lc.g/255, lc.b/255);
    (mat.uniforms.uHighColor.value as Vector3).set(hc.r/255, hc.g/255, hc.b/255);
  }, [lowColor, highColor]);

  return <div ref={containerRef} className="tunnel-container" />;
}

/* =========================
   Vaporwave Shader (Three) – 3D-ish waves menuju matahari
========================= */
type VaporProps = {
  active: boolean;
  analyser: Tone.Analyser | null | undefined;
  speed: number; quality: number;
  gridColor: string; skyTop: string; skyBottom: string; sunInner: string; sunOuter: string;
};
function Vaporwave({ active, analyser, speed, quality, gridColor, skyTop, skyBottom, sunInner, sunOuter }: VaporProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);

  useEffect(() => {
    const el = containerRef.current!;
    if (!active) {
      if (rendererRef.current) {
        rendererRef.current.setAnimationLoop(null);
        rendererRef.current.dispose();
        rendererRef.current.domElement.remove();
      }
      rendererRef.current = null; materialRef.current = null;
      return;
    }

    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    const pr = Math.min(window.devicePixelRatio * quality, 2);
    renderer.setPixelRatio(pr); renderer.setSize(el.clientWidth, el.clientHeight); el.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 10);
    camera.position.z = 1;

    const geom = new PlaneGeometry(2, 2);
    const gc = hexToRgb(gridColor);
    const st = hexToRgb(skyTop);
    const sb = hexToRgb(skyBottom);
    const si = hexToRgb(sunInner);
    const so = hexToRgb(sunOuter);

    const mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new Vector2(el.clientWidth, el.clientHeight) },
        uEnergy: { value: 0 },
        uSpeed: { value: speed },
        uGrid: { value: new Vector3(gc.r/255, gc.g/255, gc.b/255) },
        uSkyTop: { value: new Vector3(st.r/255, st.g/255, st.b/255) },
        uSkyBot: { value: new Vector3(sb.r/255, sb.g/255, sb.b/255) },
        uSunIn: { value: new Vector3(si.r/255, si.g/255, si.b/255) },
        uSunOut:{ value: new Vector3(so.r/255, so.g/255, so.b/255) },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = vec4(position,1.0); }`,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform vec2  uRes;
        uniform float uTime, uEnergy, uSpeed;
        uniform vec3  uGrid, uSkyTop, uSkyBot, uSunIn, uSunOut;

        // AA helper for modulo-based lines (uses derivative of the unsnapped coord)
        float lineAA(float coord, float width){
          float f = abs(fract(coord) - 0.5);
          float fw = fwidth(coord);
          return 1.0 - smoothstep(width, width + fw, f);
        }

        // Sun in screen-space (seperti sebelumnya)
        vec3 sun(vec2 uv){
          vec2 p = uv*2.0-1.0;
          p.x *= uRes.x/uRes.y;
          vec2 c = vec2(0.0, 0.35); // posisi matahari
          float r = length(p - c);
          float mask = smoothstep(0.35, 0.33, r);
          float t = smoothstep(0.0, 0.35, (0.35 - r));
          vec3 col = mix(uSunOut, uSunIn, t);
          // scanlines
          float lines = smoothstep(0.48, 0.5, sin((uv.y*800.0) + uTime*4.0)) * 0.25;
          float energyPulse = 0.3 * uEnergy;
          return col * mask * (1.0 - lines + energyPulse);
        }

        // 3D-ish waves via ray-plane (ground y=0), garis perspektif menuju horizon (matahari).
        vec3 groundWaves(vec2 uv){
          // Camera & projection
          float aspect = uRes.x/uRes.y;
          vec2 p = uv*2.0 - 1.0;
          p.x *= aspect;

          // Camera parameters
          float FOV = radians(60.0);
          float f = 1.0 / tan(FOV*0.5);
          // pos kamera di atas ground, sedikit mundur agar horizon sekitar 40% dari atas
          vec3 ro = vec3(0.0, 0.7, -2.5);
          vec3 rd = normalize(vec3(p.x, p.y, 1.2)); // forward ke +z

          // Intersect ke plane y=0
          if (rd.y >= 0.0) return vec3(0.0); // arah ke atas: sky
          float t = -ro.y / rd.y;
          vec3 pos = ro + rd * t; // titik di ground
          float z = pos.z;
          float x = pos.x;

          // Energi audio mengubah amplitudo & brightness
          float amp   = 0.25 * (1.0 + 1.6*uEnergy);
          float speed = 0.9 + 0.9*uSpeed;
          float time  = uTime * speed;

          // Wave offset: z dipengaruhi sin(x + time) agar garis terasa "mengalir" ke arah horizon
          float zWarp = z + amp * sin(2.0*x + time*2.0);

          // Horizontal stripes (garis-garis melintang sepanjang x, jaraknya seragam di ruang-dunia)
          float zPeriod = 0.85;
          float hz = zWarp / zPeriod;

          // Vertical lanes (garis membujur sepanjang z) — tipis untuk sensasi konvergen ke horizon
          float cell = 1.1;
          float vx = (x + 0.18*sin(0.6*z + time*0.6)) / cell;

          // Ketebalan garis (di ruang layar) — makin dekat kamera => makin tebal (perspektif)
          // scale \u2248 fungsi z (kecil di jauh, besar di dekat)
          float nearFactor = clamp(1.5 - 0.06*max(z,0.0), 0.25, 1.5);
          float wH = 0.055 * nearFactor;  // ketebalan horizontal
          float wV = 0.035 * nearFactor;  // ketebalan vertikal

          float lh = lineAA(hz, wH);   // horizontal waves
          float lv = lineAA(vx, wV) * 0.35; // vertical lanes (lebih halus)

          // Warna dasar grid + reaksi energi
          vec3 base = uGrid * (0.85 + 0.55*uEnergy);

          // Fog jauh (hilang ke hitam) + vignette tanah
          float fog = smoothstep(0.0, 1.0, clamp((z-2.0)/12.0, 0.0, 1.0));

          // Kombinasi — horizontal dominan, vertical sebagai aksen perspektif
          vec3 col = base * (lh + lv);

          // Slight glow berdasarkan kerapatan garis (tanpa putus, gunakan modulasi halus)
          float glow = smoothstep(0.0, 1.0, lh) * (0.25 + 0.35*uEnergy);
          col += base * glow;

          // Redam dengan fog (jauh makin gelap)
          col *= (1.0 - fog);

          // Hanya tampilkan jika benar-benar di bawah horizon (rd.y<0 sudah handle)
          return col;
        }

        void main(){
          // Sky gradient
          vec3 sky = mix(uSkyBot, uSkyTop, smoothstep(0.0,1.0,vUv.y));
          // Sun
          vec3 s = sun(vUv);
          // Ground waves (ray-plane)
          vec3 w = groundWaves(vUv);

          // Horizon haze tipis (transisi halus)
          float haze = smoothstep(0.46, 0.5, vUv.y) * 0.25 * (0.6 + 0.6*uEnergy);

          vec3 col = sky + s + w;
          col += vec3(1.0, 0.5, 0.9) * haze * 0.2;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const quad = new Mesh(geom, mat);
    scene.add(quad);

    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w,h);
      (mat.uniforms.uRes.value as Vector2).set(w,h);
      camera.aspect = w/h; camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize); ro.observe(el);

    let start = performance.now();
    renderer.setAnimationLoop(() => {
      const t = (performance.now() - start)/1000;
      (mat.uniforms.uTime.value as number) = t;

      // audio energy (FFT average)
      if (analyser) {
        const arr = analyser.getValue() as Float32Array;
        let sum = 0; let n = 0;
        for (let i=0;i<arr.length;i+=4){ sum += arr[i]; n++; }
        const db = sum / Math.max(1, n);
        const v = Math.min(1, Math.max(0, (db + 100) / 100));
        const prev = mat.uniforms.uEnergy.value as number;
        mat.uniforms.uEnergy.value = prev * 0.85 + v * 0.15;
      }

      (mat.uniforms.uSpeed.value as number) = speed;
      renderer.render(scene, camera);
    });

    rendererRef.current = renderer;
    materialRef.current = mat;

    return () => {
      ro.disconnect();
      renderer.setAnimationLoop(null);
      geom.dispose(); mat.dispose(); renderer.dispose();
      if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
    };
  }, [active, analyser, speed, quality, gridColor, skyTop, skyBottom, sunInner, sunOuter]);

  useEffect(() => {
    const r = rendererRef.current; if (!r) return;
    const pr = Math.min(window.devicePixelRatio * quality, 2);
    r.setPixelRatio(pr);
  }, [quality]);

  useEffect(() => {
    const mat = materialRef.current; if (!mat) return;
    const gc = hexToRgb(gridColor);
    const st = hexToRgb(skyTop);
    const sb = hexToRgb(skyBottom);
    const si = hexToRgb(sunInner);
    const so = hexToRgb(sunOuter);
    (mat.uniforms.uGrid.value as Vector3).set(gc.r/255, gc.g/255, gc.b/255);
    (mat.uniforms.uSkyTop.value as Vector3).set(st.r/255, st.g/255, st.b/255);
    (mat.uniforms.uSkyBot.value as Vector3).set(sb.r/255, sb.g/255, sb.b/255);
    (mat.uniforms.uSunIn.value as Vector3).set(si.r/255, si.g/255, si.b/255);
    (mat.uniforms.uSunOut.value as Vector3).set(so.r/255, so.g/255, so.b/255);
  }, [gridColor, skyTop, skyBottom, sunInner, sunOuter]);

  return <div ref={containerRef} className="tunnel-container" />;
}

/* =========================
   App (UI, camera, bars, etc.)
========================= */
const DEFAULTS_APP = readPersisted();

export default function App() {
  const persisted = DEFAULTS_APP;

  const [showCam, setShowCam]         = useState<boolean>(persisted.showCam);
  const [showFps, setShowFps]         = useState<boolean>(persisted.showFps);
  const [showPeople, setShowPeople]   = useState<boolean>(persisted.showPeople);

  const [bpm, setBpm]                 = useState<number>(persisted.bpm);
  const [masterVol, setMasterVol]     = useState<number>(persisted.masterVol);

  const [detectTargetFps, setDetectTargetFps] = useState<number>(persisted.detectTargetFps);
  const [barsCount, setBarsCount]     = useState<number>(persisted.barsCount);
  const [barMaxPct, setBarMaxPct]     = useState<number>(persisted.barMaxPct);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | "default">(persisted.selectedDeviceId);
  const [selectedRes, setSelectedRes]           = useState<ResKey>(persisted.selectedRes);

  const [bgType, setBgType]           = useState<BgType>(persisted.bgType);
  const [bgVideoKey, setBgVideoKey]   = useState<VideoKey>(persisted.bgVideoKey);
  const [bgGifKey, setBgGifKey]       = useState<GifKey>(persisted.bgGifKey);
  const [bgCustomUrl, setBgCustomUrl] = useState<string>(persisted.bgCustomUrl);
  const [bgBlur, setBgBlur]           = useState<number>(persisted.bgBlur);
  const [bgDim, setBgDim]             = useState<number>(persisted.bgDim);

  const [tunnelSpeed, setTunnelSpeed]     = useState<number>(persisted.tunnelSpeed);
  const [tunnelSwirl, setTunnelSwirl]     = useState<number>(persisted.tunnelSwirl);
  const [tunnelDensity, setTunnelDensity] = useState<number>(persisted.tunnelDensity);
  const [tunnelQuality, setTunnelQuality] = useState<number>(persisted.tunnelQuality);

  const [barColorLow, setBarColorLow]       = useState<string>(persisted.barColorLow);
  const [barColorHigh, setBarColorHigh]     = useState<string>(persisted.barColorHigh);
  const [tunnelColorLow, setTunnelColorLow] = useState<string>(persisted.tunnelColorLow);
  const [tunnelColorHigh, setTunnelColorHigh] = useState<string>(persisted.tunnelColorHigh);

  // Vaporwave states
  const [vaporSpeed, setVaporSpeed] = useState<number>(persisted.vaporSpeed);
  const [vaporQuality, setVaporQuality] = useState<number>(persisted.vaporQuality);
  const [vaporGridColor, setVaporGridColor] = useState<string>(persisted.vaporGridColor);
  const [vaporSkyTop, setVaporSkyTop] = useState<string>(persisted.vaporSkyTop);
  const [vaporSkyBottom, setVaporSkyBottom] = useState<string>(persisted.vaporSkyBottom);
  const [vaporSunInner, setVaporSunInner] = useState<string>(persisted.vaporSunInner);
  const [vaporSunOuter, setVaporSunOuter] = useState<string>(persisted.vaporSunOuter);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MusicEngine | null>(null);
  const [pcInstance, setPcInstance] = useState<PeopleCounter | null>(null);

  const [people, setPeople] = useState(0);
  const [openConfig, setOpenConfig] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);

  const [renderFps, setRenderFps] = useState(0);
  const [activeList, setActiveList] = useState<InstrumentId[]>([]);
  const lastRenderTS = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const barsCountRef = useRef(barsCount);
  const barMaxPctRef = useRef(barMaxPct);
  const barLowColRef = useRef(barColorLow);
  const barHighColRef = useRef(barColorHigh);
  useEffect(() => { barsCountRef.current = barsCount; }, [barsCount]);
  useEffect(() => { barMaxPctRef.current = barMaxPct; }, [barMaxPct]);
  useEffect(() => { barLowColRef.current = barColorLow; }, [barColorLow]);
  useEffect(() => { barHighColRef.current = barColorHigh; }, [barColorHigh]);

  const activeRef = useRef<InstrumentId[]>([]);

  useEffect(() => {
    writePersisted({
      showCam, showFps, showPeople,
      bpm, masterVol,
      detectTargetFps, barsCount, barMaxPct,
      selectedDeviceId, selectedRes,
      bgType, bgVideoKey, bgGifKey, bgCustomUrl, bgBlur, bgDim,
      tunnelSpeed, tunnelSwirl, tunnelDensity, tunnelQuality,
      barColorLow, barColorHigh, tunnelColorLow, tunnelColorHigh,
      vaporSpeed, vaporQuality, vaporGridColor, vaporSkyTop, vaporSkyBottom, vaporSunInner, vaporSunOuter,
    });
  }, [
    showCam, showFps, showPeople,
    bpm, masterVol,
    detectTargetFps, barsCount, barMaxPct,
    selectedDeviceId, selectedRes,
    bgType, bgVideoKey, bgGifKey, bgCustomUrl, bgBlur, bgDim,
    tunnelSpeed, tunnelSwirl, tunnelDensity, tunnelQuality,
    barColorLow, barColorHigh, tunnelColorLow, tunnelColorHigh,
    vaporSpeed, vaporQuality, vaporGridColor, vaporSkyTop, vaporSkyBottom, vaporSunInner, vaporSunOuter,
  ]);

  const resetSettings = async () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    const d = { ...DEFAULTS };
    setShowCam(d.showCam); setShowFps(d.showFps); setShowPeople(d.showPeople);
    setBpm(d.bpm); setMasterVol(d.masterVol);
    setDetectTargetFps(d.detectTargetFps); setBarsCount(d.barsCount); setBarMaxPct(d.barMaxPct);
    setSelectedDeviceId(d.selectedDeviceId as "default"); setSelectedRes(d.selectedRes);
    setBgType(d.bgType); setBgVideoKey(d.bgVideoKey); setBgGifKey(d.bgGifKey);
    setBgCustomUrl(d.bgCustomUrl); setBgBlur(d.bgBlur); setBgDim(d.bgDim);
    setTunnelSpeed(d.tunnelSpeed); setTunnelSwirl(d.tunnelSwirl);
    setTunnelDensity(d.tunnelDensity); setTunnelQuality(d.tunnelQuality);
    setBarColorLow(d.barColorLow); setBarColorHigh(d.barColorHigh);
    setTunnelColorLow(d.tunnelColorLow); setTunnelColorHigh(d.tunnelColorHigh);
    setVaporSpeed(d.vaporSpeed); setVaporQuality(d.vaporQuality);
    setVaporGridColor(d.vaporGridColor);
    setVaporSkyTop(d.vaporSkyTop); setVaporSkyBottom(d.vaporSkyBottom);
    setVaporSunInner(d.vaporSunInner); setVaporSunOuter(d.vaporSunOuter);
    await startStream("default", "720p");
  };

  const startStream = async (deviceId?: string | "default", resKey?: ResKey) => {
    const videoEl = videoRef.current!;
    const prev = videoEl.srcObject as MediaStream | null;
    if (prev) prev.getTracks().forEach((t) => t.stop());

    const key = resKey || selectedRes;
    const { w, h } = RESOLUTIONS[key];

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        width: { ideal: w }, height: { ideal: h },
        frameRate: { ideal: 60, max: 60 },
        ...(deviceId && deviceId !== "default"
          ? { deviceId: { exact: deviceId } }
          : { facingMode: "user" }),
      },
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
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

      const cvs = canvasRef.current!; const ctx = cvs.getContext("2d")!;

      const draw = (ts: number) => {
        if (!engineRef.current) {
          rafIdRef.current = requestAnimationFrame(draw);
          return;
        }
        if (lastRenderTS.current != null) {
          const dt = ts - lastRenderTS.current;
          const rawFps = dt > 0 ? 1000 / dt : 0;
          const clamped = Math.min(Math.max(rawFps, 0), 240);
          setRenderFps((p) => p ? p * 0.85 + clamped * 0.15 : clamped);
        }
        lastRenderTS.current = ts;

        const analyser = engineRef.current.analyser;
        const values = analyser.getValue() as Float32Array;
        render2D(values, cvs, ctx, barsCountRef.current, barMaxPctRef.current, barLowColRef.current, barHighColRef.current);

        rafIdRef.current = requestAnimationFrame(draw);
      };

      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(draw);

      const pc = new PeopleCounter(videoRef.current!);
      pc.onCount = (n: number) => {
        const target = Math.min(10, n);
        setPeople(target);
        applyInstruments(target);
      };
      await pc.start(detectTargetFps);
      setPcInstance(pc);
    })().catch((e) => {
      console.error("Startup error:", e);
      alert("Startup error: " + (e?.message || e));
    });

    return () => {
      cancelled = true;
      if (rafIdRef.current != null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
      if (pcInstance) pcInstance.stop();
      const v = videoRef.current;
      if (v && v.srcObject) { (v.srcObject as MediaStream).getTracks().forEach(t => t.stop()); v.srcObject = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (pcInstance) { pcInstance.stop(); pcInstance.start(detectTargetFps); } }, [detectTargetFps, pcInstance]);
  useEffect(() => { if (engineRef.current) engineRef.current.transport.bpm.rampTo(bpm, 0.3); }, [bpm]);
  useEffect(() => { if (engineRef.current) engineRef.current.master.gain.rampTo(Math.max(0, Math.min(1, masterVol / 100)), 0.25); }, [masterVol]);

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
    activeRef.current = current; setActiveList([...current]);
  }

  const handleChangeCamera = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value; setSelectedDeviceId(id);
    await startStream(id as string, selectedRes);
  };
  const handleChangeRes = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value as ResKey; setSelectedRes(key);
    await startStream(selectedDeviceId, key);
  };

  const render2D = (
    values: Float32Array,
    cvs: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    bars: number,
    maxPct: number,
    lowHex: string,
    highHex: string
  ) => {
    const w = cvs.clientWidth, h = cvs.clientHeight;
    if (cvs.width !== w || cvs.height !== h) { cvs.width = w; cvs.height = h; }

    ctx.clearRect(0,0,w,h);

    const barsClamped = Math.max(20, Math.min(200, bars));
    const step = Math.max(1, Math.floor(values.length / barsClamped));
    const barW = (w / barsClamped) * 0.8;
    const maxH = h * (Math.max(10, Math.min(100, maxPct)) / 100);

    const lc = hexToRgb(lowHex);
    const hc = hexToRgb(highHex);

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
  };

  const currentVideoUrl =
    (bgCustomUrl && bgType === "video") ? bgCustomUrl : BG_VIDEOS[bgVideoKey]?.url;
  const currentGifUrl =
    (bgCustomUrl && bgType === "gif") ? bgCustomUrl : BG_GIFS[bgGifKey]?.url;

  return (
    <div className="relative h-dvh w-screen overflow-hidden text-white bg-black">
      {/* BACKGROUND */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {bgType === "gradient" && <div className="absolute inset-0 bg-audio-gradient" />}
        {bgType === "particles" && <div className="absolute inset-0 bg-audio-gradient" />}

        {bgType === "video" && (
          <video
            key={currentVideoUrl}
            src={currentVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-cover will-change-transform"
            style={{ filter: `blur(${bgBlur}px)`, transform: bgBlur ? "scale(1.03)" : "none" }}
          />
        )}

        {bgType === "gif" && (
          <img
            key={currentGifUrl}
            src={currentGifUrl}
            alt="bg"
            className="absolute inset-0 h-full w-full object-cover will-change-transform"
            style={{ filter: `blur(${bgBlur}px)`, transform: bgBlur ? "scale(1.03)" : "none" }}
          />
        )}

        {bgType === "tunnel" && (
          <AudioTunnel
            active={true}
            analyser={engineRef.current?.analyser}
            speed={tunnelSpeed}
            swirl={tunnelSwirl}
            density={tunnelDensity}
            quality={tunnelQuality}
            lowColor={tunnelColorLow}
            highColor={tunnelColorHigh}
          />
        )}

        {bgType === "vaporwave" && (
          <Vaporwave
            active={true}
            analyser={engineRef.current?.analyser}
            speed={vaporSpeed}
            quality={vaporQuality}
            gridColor={vaporGridColor}
            skyTop={vaporSkyTop}
            skyBottom={vaporSkyBottom}
            sunInner={vaporSunInner}
            sunOuter={vaporSunOuter}
          />
        )}

        {(bgType === "video" || bgType === "gif" || bgType === "tunnel" || bgType === "vaporwave") && bgDim > 0 && (
          <div className="absolute inset-0" style={{ background: `rgba(0,0,0, ${bgDim / 100})` }} />
        )}
      </div>

      {/* Visualizer */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />

      {/* Hamburger */}
      <button
        onClick={() => setOpenConfig(true)}
        className="absolute right-4 top-4 z-30 h-11 w-11 grid place-items-center rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 backdrop-blur cursor-pointer"
        aria-label="Open config"
        title="Open config"
      >
        <div className="space-y-1">
          <span className="block h-0.5 w-6 bg-white/90 rounded" />
          <span className="block h-0.5 w-6 bg-white/90 rounded" />
          <span className="block h-0.5 w-6 bg-white/90 rounded" />
        </div>
      </button>

      {/* People chip */}
      {showPeople && (
        <div className="absolute right-4 top-20 z-20 rounded-xl px-3 py-1.5 bg-white/10 border border-white/10">
          <div className="text-[10px] uppercase tracking-wide text-white/60">People</div>
          <div className="text-lg font-bold leading-none text-white">{people}</div>
        </div>
      )}

      {/* Camera preview */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={[
          "absolute bottom-4 left-4 z-20 w-[320px] h-[180px] object-cover rounded-xl border",
          showCam ? "opacity-70 border-white/20" : "opacity-0 pointer-events-none"
        ].join(" ")}
      />

      {/* FPS */}
      {showFps && (
        <div className="absolute left-4 top-4 z-20 rounded-xl border border-white/10 bg-black/40 backdrop-blur px-3 py-2 text-xs">
          <div>FPS: <span className="font-semibold text-white">{renderFps.toFixed(1)}</span></div>
        </div>
      )}

      {/* CONFIG MODAL */}
      {openConfig && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm">
          <div className="w-[1200px] max-w-[95vw] rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-cyan-400/20 grid place-items-center">
                  <span className="text-xl">⚙️</span>
                </div>
                <div>
                  <h2 className="text-base font-semibold leading-tight">Booth Config</h2>
                  <p className="text-xs text-white/60 -mt-0.5">Background · Performance · Camera · Mix · Active Tracks</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetSettings}
                  className="h-9 px-3 grid place-items-center rounded-lg border border-red-400/30 text-red-200 bg-red-500/10 hover:bg-red-500/15 text-sm cursor-pointer"
                  title="Reset settings (clear localStorage)"
                >
                  Reset Settings
                </button>
                <button
                  onClick={() => setOpenConfig(false)}
                  className="h-9 w-9 grid place-items-center rounded-lg border border-white/10 bg-white/10 hover:bg-white/15 cursor-pointer"
                  aria-label="Close"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Background (span 2) */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                <div className="text-sm font-semibold mb-3">Background</div>

                <label className="block text-xs text-white/60 mb-1">Type</label>
                <select
                  value={bgType}
                  onChange={(e) => setBgType(e.target.value as BgType)}
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm mb-3"
                >
                  <option value="none">No Background (Black)</option>
                  <option value="gradient">Gradient</option>
                  <option value="video">Video</option>
                  <option value="gif">GIF / Image</option>
                  <option value="particles">Visualizer (Particles)</option>
                  <option value="tunnel">Tunnel (3D Shader)</option>
                  <option value="vaporwave">Vaporwave (3D-ish Waves)</option>
                </select>

                {/* video */}
                {bgType === "video" && (
                  <>
                    <label className="block text-xs text-white/60 mb-1">Preset Video</label>
                    <select
                      value={bgVideoKey}
                      onChange={(e) => setBgVideoKey(e.target.value as VideoKey)}
                      className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm"
                    >
                      {(Object.keys(BG_VIDEOS) as VideoKey[]).map((k) => (
                        <option key={k} value={k}>{BG_VIDEOS[k].label}</option>
                      ))}
                    </select>

                    <label className="block text-xs text-white/60 mt-3 mb-1">Custom Video URL (mp4)</label>
                    <input
                      placeholder="https://example.com/video.mp4"
                      value={bgCustomUrl}
                      onChange={(e) => setBgCustomUrl(e.target.value)}
                      className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm"
                    />
                  </>
                )}

                {/* gif */}
                {bgType === "gif" && (
                  <>
                    <label className="block text-xs text-white/60 mb-1">Preset GIF</label>
                    <select
                      value={bgGifKey}
                      onChange={(e) => setBgGifKey(e.target.value as GifKey)}
                      className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm"
                    >
                      {(Object.keys(BG_GIFS) as GifKey[]).map((k) => (
                        <option key={k} value={k}>{BG_GIFS[k].label}</option>
                      ))}
                    </select>

                    <label className="block text-xs text-white/60 mt-3 mb-1">Custom GIF/Image URL</label>
                    <input
                      placeholder="https://example.com/animated.gif"
                      value={bgCustomUrl}
                      onChange={(e) => setBgCustomUrl(e.target.value)}
                      className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm"
                    />
                  </>
                )}

                {/* tunnel */}
                {bgType === "tunnel" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm text-white/80">Speed</span>
                          <span className="text-xs text-white/60">{tunnelSpeed.toFixed(2)}</span>
                        </div>
                        <input type="range" min={0.2} max={3} step={0.05} value={tunnelSpeed}
                          onChange={(e) => setTunnelSpeed(parseFloat(e.target.value))}
                          className="w-full accent-cyan-400" />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm text-white/80">Swirl</span>
                          <span className="text-xs text-white/60">{tunnelSwirl.toFixed(1)}</span>
                        </div>
                        <input type="range" min={0} max={8} step={0.1} value={tunnelSwirl}
                          onChange={(e) => setTunnelSwirl(parseFloat(e.target.value))}
                          className="w-full accent-fuchsia-400" />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm text-white/80">Density</span>
                          <span className="text-xs text-white/60">{tunnelDensity.toFixed(0)}</span>
                        </div>
                        <input type="range" min={4} max={24} step={1} value={tunnelDensity}
                          onChange={(e) => setTunnelDensity(parseFloat(e.target.value))}
                          className="w-full accent-cyan-400" />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm text-white/80">Quality</span>
                          <span className="text-xs text-white/60">{tunnelQuality.toFixed(2)}×</span>
                        </div>
                        <input type="range" min={0.75} max={2} step={0.05} value={tunnelQuality}
                          onChange={(e) => setTunnelQuality(parseFloat(e.target.value))}
                          className="w-full accent-fuchsia-400" />
                        <div className="text-[11px] text-white/45 mt-1">Turunkan Quality bila FPS drop.</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Tunnel Low Color</label>
                        <input type="color" value={tunnelColorLow} onChange={(e) => setTunnelColorLow(e.target.value)}
                          className="h-9 w-full rounded-md bg-black/30 border border-white/10" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Tunnel High Color</label>
                        <input type="color" value={tunnelColorHigh} onChange={(e) => setTunnelColorHigh(e.target.value)}
                          className="h-9 w-full rounded-md bg-black/30 border border-white/10" />
                      </div>
                    </div>
                  </>
                )}

                {/* vaporwave */}
                {bgType === "vaporwave" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm text-white/80">Speed (Waves scroll)</span>
                          <span className="text-xs text-white/60">{vaporSpeed.toFixed(2)}</span>
                        </div>
                        <input type="range" min={0.2} max={2.5} step={0.05} value={vaporSpeed}
                          onChange={(e) => setVaporSpeed(parseFloat(e.target.value))}
                          className="w-full accent-cyan-400" />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm text-white/80">Quality</span>
                          <span className="text-xs text-white/60">{vaporQuality.toFixed(2)}×</span>
                        </div>
                        <input type="range" min={0.75} max={2} step={0.05} value={vaporQuality}
                          onChange={(e) => setVaporQuality(parseFloat(e.target.value))}
                          className="w-full accent-fuchsia-400" />
                        <div className="text-[11px] text-white/45 mt-1">Turunkan Quality bila FPS drop.</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Waves Color</label>
                        <input type="color" value={vaporGridColor} onChange={(e)=>setVaporGridColor(e.target.value)}
                          className="h-9 w-full rounded-md bg-black/30 border border-white/10" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Sky Top</label>
                        <input type="color" value={vaporSkyTop} onChange={(e)=>setVaporSkyTop(e.target.value)}
                          className="h-9 w-full rounded-md bg-black/30 border border-white/10" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Sky Bottom</label>
                        <input type="color" value={vaporSkyBottom} onChange={(e)=>setVaporSkyBottom(e.target.value)}
                          className="h-9 w-full rounded-md bg-black/30 border border-white/10" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Sun Inner</label>
                        <input type="color" value={vaporSunInner} onChange={(e)=>setVaporSunInner(e.target.value)}
                          className="h-9 w-full rounded-md bg-black/30 border border-white/10" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/60 mb-1">Sun Outer</label>
                        <input type="color" value={vaporSunOuter} onChange={(e)=>setVaporSunOuter(e.target.value)}
                          className="h-9 w-full rounded-md bg-black/30 border border-white/10" />
                      </div>
                    </div>
                  </>
                )}

                {(bgType === "video" || bgType === "gif") && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm text-white/80">Blur</span>
                        <span className="text-xs text-white/60">{bgBlur}px</span>
                      </div>
                      <input type="range" min={0} max={12} step={1} value={bgBlur}
                        onChange={(e) => setBgBlur(parseInt(e.target.value))}
                        className="w-full accent-cyan-400" />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm text-white/80">Dim</span>
                        <span className="text-xs text-white/60">{bgDim}%</span>
                      </div>
                      <input type="range" min={0} max={80} step={1} value={bgDim}
                        onChange={(e) => setBgDim(parseInt(e.target.value))}
                        className="w-full accent-fuchsia-400" />
                    </div>
                  </div>
                )}
              </div>

              {/* Perf & Camera & Mix */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold mb-2">Performance & Overlay</div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-white/80">Detection FPS</span>
                    <span className="text-xs text-white/60">max 60</span>
                  </div>
                  <input type="range" min={30} max={60} step={5} value={detectTargetFps}
                    onChange={(e) => setDetectTargetFps(parseInt(e.target.value))}
                    className="w-full accent-cyan-400" />
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-white/80">Bars Count</span>
                    <span className="text-xs text-white/60">{barsCount}</span>
                  </div>
                  <input type="range" min={40} max={120} step={4} value={barsCount}
                    onChange={(e) => setBarsCount(parseInt(e.target.value))}
                    className="w-full accent-fuchsia-400" />
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-white/80">Bar Max Height</span>
                    <span className="text-xs text-white/60">{barMaxPct}%</span>
                  </div>
                  <input type="range" min={20} max={100} step={1} value={barMaxPct}
                    onChange={(e) => setBarMaxPct(parseInt(e.target.value))}
                    className="w-full accent-emerald-400" />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Bar Low Color</label>
                    <input type="color" value={barColorLow} onChange={(e) => setBarColorLow(e.target.value)}
                      className="h-9 w-full rounded-md bg-black/30 border border-white/10" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Bar High Color</label>
                    <input type="color" value={barColorHigh} onChange={(e) => setBarColorHigh(e.target.value)}
                      className="h-9 w-full rounded-md bg-black/30 border border-white/10" />
                  </div>
                </div>

                <div className="border-t border-white/10 my-4" />

                <div className="text-sm font-semibold mb-2">Camera</div>
                <label className="block text-xs text-white/60 mb-1">Device</label>
                <select value={selectedDeviceId} onChange={handleChangeCamera}
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm">
                  {cameras.length === 0 && <option value="default">Default</option>}
                  {cameras.map((cam) => (
                    <option key={cam.deviceId || cam.label} value={cam.deviceId}>
                      {cam.label || `Camera ${cam.deviceId.slice(-4)}`}
                    </option>
                  ))}
                </select>

                <label className="block text-xs text-white/60 mt-3 mb-1">Resolution</label>
                <select value={selectedRes} onChange={handleChangeRes}
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm">
                  {(Object.keys(RESOLUTIONS) as ResKey[]).map((k) => (
                    <option key={k} value={k}>{RESOLUTIONS[k].label}</option>
                  ))}
                </select>

                {/* Toggles */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-white/80">Camera Preview</span>
                  <button
                    onClick={() => setShowCam(v => !v)}
                    className={[
                      "relative inline-flex h-8 w-14 items-center rounded-full border transition",
                      showCam ? "border-cyan-400/30 bg-cyan-400/20" : "border-white/10 bg-white/5"
                    ].join(" ")}
                  >
                    <span className={["inline-block h-6 w-6 transform rounded-full bg-white transition", showCam ? "translate-x-7" : "translate-x-1"].join(" ")} />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-white/80">Show FPS Overlay</span>
                  <button
                    onClick={() => setShowFps(v => !v)}
                    className={[
                      "relative inline-flex h-8 w-14 items-center rounded-full border transition",
                      showFps ? "border-cyan-400/30 bg-cyan-400/20" : "border-white/10 bg-white/5"
                    ].join(" ")}
                  >
                    <span className={["inline-block h-6 w-6 transform rounded-full bg-white transition", showFps ? "translate-x-7" : "translate-x-1"].join(" ")} />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-white/80">Show People Overlay</span>
                  <button
                    onClick={() => setShowPeople(v => !v)}
                    className={[
                      "relative inline-flex h-8 w-14 items-center rounded-full border transition",
                      showPeople ? "border-cyan-400/30 bg-cyan-400/20" : "border-white/10 bg-white/5"
                    ].join(" ")}
                  >
                    <span className={["inline-block h-6 w-6 transform rounded-full bg-white transition", showPeople ? "translate-x-7" : "translate-x-1"].join(" ")} />
                  </button>
                </div>
              </div>

              {/* Active Tracks */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold mb-2">Active Tracks</div>
                <div className="text-xs text-white/60 mb-3">Urutan: Kick → Piano → Hi-Hat → Bass → Pad → Lead → Perc → Pluck → FX → Snare.</div>
                <ul className="space-y-2">
                  { ORDER.map((id, idx) => {
                      const active = activeList.includes(id);
                      return (
                        <li key={id} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 bg-black/20">
                          <div className="flex items-center gap-2">
                            <span className={["inline-block h-2.5 w-2.5 rounded-full", active ? "bg-emerald-400 animate-pulse" : "bg-white/25"].join(" ")} />
                            <span className={active ? "text-white" : "text-white/60"}>{idx+1}. {INSTRUMENT_LABEL[id]}</span>
                          </div>
                          <span className={active ? "text-emerald-300 text-xs" : "text-white/40 text-xs"}>{active ? "ON" : "off"}</span>
                        </li>
                      );
                    })
                  }
                </ul>
              </div>
            </div>

            <div className="px-5 pb-4 text-[11px] text-white/45">
              Tunnel = 3D stripes, Vaporwave = 3D-ish waves menuju matahari (ray–plane). Keduanya reaktif ke energi audio (FFT) dari Tone.js.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
