type FpsProps = { show: boolean; value: number };
export function FpsBadge({ show, value }: FpsProps){
  if (!show) return null;
  return (
    <div className="absolute left-4 top-4 z-20 rounded-xl border border-white/10 bg-black/40 backdrop-blur px-3 py-2 text-xs">
      <div>FPS: <span className="font-semibold text-white">{value.toFixed(1)}</span></div>
    </div>
  );
}

type PeopleProps = { show: boolean; count: number };
export function PeopleChip({ show, count }: PeopleProps){
  if (!show) return null;
  return (
    <div className="absolute right-4 top-20 z-20 rounded-xl px-3 py-1.5 bg-white/10 border border-white/10">
      <div className="text-[10px] uppercase tracking-wide text-white/60">People</div>
      <div className="text-lg font-bold leading-none text-white">{count}</div>
    </div>
  );
}

type CamProps = { show: boolean; videoRef: React.RefObject<HTMLVideoElement> };
export function CameraPreview({ show, videoRef }: CamProps){
  return (
    <video
      ref={videoRef}
      playsInline
      muted
      className={[
        "absolute bottom-4 left-4 z-20 w-[320px] h-[180px] object-cover rounded-xl border transition-opacity",
        show ? "opacity-70 border-white/20" : "opacity-0 pointer-events-none"
      ].join(" ")}
    />
  );
}

type HambProps = { onClick: () => void };
export function Hamburger({ onClick }: HambProps){
  return (
    <button
      onClick={onClick}
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
  );
}
