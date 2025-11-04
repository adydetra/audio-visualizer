import React from "react";

type ResKey = "360p" | "540p" | "720p" | "1080p";
type BgType = "none" | "gradient" | "video" | "gif" | "particles" | "tunnel" | "vaporwave";

type VideoItem = { label: string; url: string };
type GifItem   = { label: string; url: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onReset: () => void;

  // background
  bgType: BgType; setBgType: (v: BgType) => void;
  bgVideoKey: string; setBgVideoKey: (v: string) => void;
  bgGifKey: string; setBgGifKey: (v: string) => void;
  bgCustomUrl: string; setBgCustomUrl: (v: string) => void;
  bgBlur: number; setBgBlur: (n: number) => void;
  bgDim: number; setBgDim: (n: number) => void;

  // lists
  videos: Record<string, VideoItem>;
  gifs:   Record<string, GifItem>;

  // tunnel
  tunnelSpeed: number; setTunnelSpeed: (n: number) => void;
  tunnelSwirl: number; setTunnelSwirl: (n: number) => void;
  tunnelDensity: number; setTunnelDensity: (n: number) => void;
  tunnelQuality: number; setTunnelQuality: (n: number) => void;
  tunnelColorLow: string; setTunnelColorLow: (v: string) => void;
  tunnelColorHigh: string; setTunnelColorHigh: (v: string) => void;

  // vaporwave
  vaporSpeed: number; setVaporSpeed: (n: number) => void;
  vaporQuality: number; setVaporQuality: (n: number) => void;
  vaporGridColor: string; setVaporGridColor: (v: string) => void;
  vaporSkyTop: string; setVaporSkyTop: (v: string) => void;
  vaporSkyBottom: string; setVaporSkyBottom: (v: string) => void;
  vaporSkySolid: string; setVaporSkySolid: (v: string) => void;
  vaporSkyMix: number; setVaporSkyMix: (n: number) => void;
  vaporSunInner: string; setVaporSunInner: (v: string) => void;
  vaporSunOuter: string; setVaporSunOuter: (v: string) => void;
  vaporSunHeight: number; setVaporSunHeight: (n: number) => void;
  vaporSunRadius: number; setVaporSunRadius: (n: number) => void;

  // performance + bars
  detectTargetFps: number; setDetectTargetFps: (n: number) => void;
  barsCount: number; setBarsCount: (n: number) => void;
  barMaxPct: number; setBarMaxPct: (n: number) => void;
  barColorLow: string; setBarColorLow: (v: string) => void;
  barColorHigh: string; setBarColorHigh: (v: string) => void;

  // camera
  cameras: MediaDeviceInfo[];
  selectedDeviceId: string | "default";
  setSelectedDeviceId: (v: string | "default") => void;
  onChangeCamera: (e: React.ChangeEvent<HTMLSelectElement>) => void;

  selectedRes: ResKey; onChangeRes: (e: React.ChangeEvent<HTMLSelectElement>) => void;

  // toggles
  showCam: boolean;      setShowCam: (v: boolean | ((p:boolean)=>boolean)) => void;
  showFps: boolean;      setShowFps: (v: boolean | ((p:boolean)=>boolean)) => void;
  showPeople: boolean;   setShowPeople: (v: boolean | ((p:boolean)=>boolean)) => void;
};

export default function ConfigModal(props: Props){
  if (!props.open) return null;
  const {
    onClose, onReset,
    bgType, setBgType, bgVideoKey, setBgVideoKey, bgGifKey, setBgGifKey,
    bgCustomUrl, setBgCustomUrl, bgBlur, setBgBlur, bgDim, setBgDim,
    videos, gifs,
    tunnelSpeed, setTunnelSpeed, tunnelSwirl, setTunnelSwirl, tunnelDensity, setTunnelDensity,
    tunnelQuality, setTunnelQuality, tunnelColorLow, setTunnelColorLow, tunnelColorHigh, setTunnelColorHigh,
    vaporSpeed, setVaporSpeed, vaporQuality, setVaporQuality, vaporGridColor, setVaporGridColor,
    vaporSkyTop, setVaporSkyTop, vaporSkyBottom, setVaporSkyBottom, vaporSkySolid, setVaporSkySolid,
    vaporSkyMix, setVaporSkyMix,
    vaporSunInner, setVaporSunInner, vaporSunOuter, setVaporSunOuter, vaporSunHeight, setVaporSunHeight, vaporSunRadius, setVaporSunRadius,
    detectTargetFps, setDetectTargetFps, barsCount, setBarsCount, barMaxPct, setBarMaxPct, barColorLow, setBarColorLow, barColorHigh, setBarColorHigh,
    selectedDeviceId, onChangeCamera, showCam, setShowCam, showFps, setShowFps, showPeople, setShowPeople
  } = props;

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm">
      <div className="w-[1200px] max-w-[95vw] rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
        {/* Header */}
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
              onClick={onReset}
              className="h-9 px-3 grid place-items-center rounded-lg border border-red-400/30 text-red-200 bg-red-500/10 hover:bg-red-500/15 text-sm cursor-pointer"
              title="Reset settings"
            >
              Reset Settings
            </button>
            <button
              onClick={onClose}
              className="h-9 w-9 grid place-items-center rounded-lg border border-white/10 bg-white/10 hover:bg-white/15 cursor-pointer"
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Background */}
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

            {bgType === "video" && (
              <>
                <label className="block text-xs text-white/60 mb-1">Preset Video</label>
                <select
                  value={bgVideoKey}
                  onChange={(e) => setBgVideoKey(e.target.value)}
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm"
                >
                  {Object.keys(videos).map((k) => (
                    <option key={k} value={k}>{videos[k].label}</option>
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

            {bgType === "gif" && (
              <>
                <label className="block text-xs text-white/60 mb-1">Preset GIF</label>
                <select
                  value={bgGifKey}
                  onChange={(e) => setBgGifKey(e.target.value)}
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm"
                >
                  {Object.keys(gifs).map((k) => (
                    <option key={k} value={k}>{gifs[k].label}</option>
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

            {bgType === "tunnel" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Range label="Speed" value={tunnelSpeed} set={setTunnelSpeed} min={0.2} max={3} step={0.05} />
                  <Range label="Swirl" value={tunnelSwirl} set={setTunnelSwirl} min={0} max={8} step={0.1} />
                  <Range label="Density" value={tunnelDensity} set={setTunnelDensity} min={4} max={24} step={1} />
                  <Range label="Quality" value={tunnelQuality} set={setTunnelQuality} min={0.75} max={2} step={0.05} suffix="×" />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <Color label="Tunnel Low Color" value={tunnelColorLow} set={setTunnelColorLow} />
                  <Color label="Tunnel High Color" value={tunnelColorHigh} set={setTunnelColorHigh} />
                </div>
              </>
            )}

            {bgType === "vaporwave" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Range label="Speed (Waves scroll)" value={vaporSpeed} set={setVaporSpeed} min={0.2} max={2.5} step={0.05} />
                  <Range label="Quality" value={vaporQuality} set={setVaporQuality} min={0.75} max={2} step={0.05} suffix="×" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  <Color label="Waves Color" value={vaporGridColor} set={setVaporGridColor} />
                  <Color label="Sky Top" value={vaporSkyTop} set={setVaporSkyTop} />
                  <Color label="Sky Bottom" value={vaporSkyBottom} set={setVaporSkyBottom} />
                  <Color label="Sun Inner" value={vaporSunInner} set={setVaporSunInner} />
                  <Color label="Sun Outer" value={vaporSunOuter} set={setVaporSunOuter} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <Color label="Sky Solid" value={vaporSkySolid} set={setVaporSkySolid} />
                  <Range label="Sky Mix" value={vaporSkyMix} set={setVaporSkyMix} min={0} max={1} step={0.01} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <Range label="Sun Height" value={vaporSunHeight} set={setVaporSunHeight} min={0} max={1} step={0.001} />
                  <Range label="Sun Size" value={vaporSunRadius} set={setVaporSunRadius} min={0.15} max={0.6} step={0.001} />
                </div>
              </>
            )}

            {(bgType === "video" || bgType === "gif") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Range label="Blur" value={bgBlur} set={setBgBlur} min={0} max={12} step={1} suffix="px" />
                <Range label="Dim" value={bgDim} set={setBgDim} min={0} max={80} step={1} suffix="%" />
              </div>
            )}
          </div>

          {/* Performance & Overlay */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold mb-2">Performance & Overlay</div>
            <Range label="Detection FPS" value={detectTargetFps} set={setDetectTargetFps} min={30} max={60} step={5} note="max 60" />
            <Range label="Bars Count" value={barsCount} set={setBarsCount} min={40} max={120} step={4} />
            <Range label="Bar Max Height" value={barMaxPct} set={setBarMaxPct} min={20} max={100} step={1} suffix="%" />
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Color label="Bar Low Color" value={barColorLow} set={setBarColorLow} />
              <Color label="Bar High Color" value={barColorHigh} set={setBarColorHigh} />
            </div>

            <div className="border-t border-white/10 my-4" />

            <div className="text-sm font-semibold mb-2">Camera</div>
            <label className="block text-xs text-white/60 mb-1">Device</label>
            <select value={selectedDeviceId} onChange={onChangeCamera}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm">
              {props.cameras.length === 0 && <option value="default">Default</option>}
              {props.cameras.map((cam) => (
                <option key={cam.deviceId || cam.label} value={cam.deviceId}>
                  {cam.label || `Camera ${cam.deviceId.slice(-4)}`}
                </option>
              ))}
            </select>

            <label className="block text-xs text-white/60 mt-3 mb-1">Resolution</label>
            <select value={props.selectedRes} onChange={props.onChangeRes}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm">
              <option value="360p">640×360 (360p)</option>
              <option value="540p">960×540 (540p)</option>
              <option value="720p">1280×720 (720p)</option>
              <option value="1080p">1920×1080 (1080p)</option>
            </select>

            {/* Toggles */}
            <Toggle label="Camera Preview" checked={showCam} onChange={() => setShowCam(v => typeof v === "boolean" ? !v : true)} />
            <Toggle label="Show FPS Overlay" checked={showFps} onChange={() => setShowFps(v => typeof v === "boolean" ? !v : true)} />
            <Toggle label="Show People Overlay" checked={showPeople} onChange={() => setShowPeople(v => typeof v === "boolean" ? !v : true)} />
          </div>

          {/* Active Tracks panel sengaja disederhanakan, tetap sama di App (list status) */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold mb-2">Active Tracks</div>
            <div className="text-xs text-white/60">Urutan: Kick → Piano → Hi-Hat → Bass → Pad → Lead → Perc → Pluck → FX → Snare.</div>
            <div className="text-[11px] text-white/45 mt-2">Daftar ON/OFF mengikuti jumlah People di overlay.</div>
          </div>
        </div>

        <div className="px-5 pb-4 text-[11px] text-white/45">
          Tunnel = 3D stripes, Vaporwave = 3D-ish waves menuju matahari. Keduanya reaktif FFT Tone.js.
        </div>
      </div>
    </div>
  );
}

function Range({
  label, value, set, min, max, step, suffix, note
}: { label:string; value:number; set:(n:number)=>void; min:number; max:number; step:number; suffix?:string; note?:string }){
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-white/80">{label}</span>
        <span className="text-xs text-white/60">{value.toFixed( (step<1 && step!==Math.floor(step)) ? 2 : 0)}{suffix || ""}{note ? ` · ${note}` : ""}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e)=>set(parseFloat(e.target.value))}
        className="w-full accent-cyan-400" />
    </div>
  );
}

function Color({label, value, set}:{label:string; value:string; set:(v:string)=>void}){
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <input type="color" value={value} onChange={(e)=>set(e.target.value)}
        className="h-9 w-full rounded-md bg-black/30 border border-white/10" />
    </div>
  );
}

function Toggle({label, checked, onChange}:{label:string; checked:boolean; onChange:()=>void}){
  return (
    <div className="mt-3 flex items-center justify-between">
      <span className="text-sm text-white/80">{label}</span>
      <button
        onClick={onChange}
        className={[
          "relative inline-flex h-8 w-14 items-center rounded-full border transition",
          checked ? "border-cyan-400/30 bg-cyan-400/20" : "border-white/10 bg-white/5"
        ].join(" ")}
      >
        <span className={["inline-block h-6 w-6 transform rounded-full bg-white transition", checked ? "translate-x-7" : "translate-x-1"].join(" ")} />
      </button>
    </div>
  );
}
