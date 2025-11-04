import Vaporwave from "./Vaporwave";
import AudioTunnel from "./AudioTunnel";

type BgType = "none" | "gradient" | "video" | "gif" | "particles" | "tunnel" | "vaporwave";

type Props = {
  bgType: BgType;
  // common
  dimPercent: number;    // 0..100
  blurPx: number;        // only for video/gif
  // video/gif
  videoUrl?: string | null;
  gifUrl?: string | null;
  // tunnel
  analyser: any;
  tunnelSpeed: number; tunnelSwirl: number; tunnelDensity: number; tunnelQuality: number;
  tunnelColorLow: string; tunnelColorHigh: string;
  // vaporwave
  vaporSpeed: number; vaporQuality: number;
  vaporGridColor: string;
  vaporSkyTop: string; vaporSkyBottom: string;
  vaporSkySolid: string; vaporSkyMix: number;
  vaporSunInner: string; vaporSunOuter: string;
  vaporSunHeight: number; vaporSunRadius: number;
};

export default function BackgroundRenderer({
  bgType, dimPercent, blurPx,
  videoUrl, gifUrl,
  analyser,
  tunnelSpeed, tunnelSwirl, tunnelDensity, tunnelQuality, tunnelColorLow, tunnelColorHigh,
  vaporSpeed, vaporQuality, vaporGridColor, vaporSkyTop, vaporSkyBottom, vaporSkySolid, vaporSkyMix,
  vaporSunInner, vaporSunOuter, vaporSunHeight, vaporSunRadius
}: Props){
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {(bgType === "none" || bgType === "particles") && (
        <div className="absolute inset-0 bg-black" />
      )}

      {bgType === "gradient" && (
        <div className="absolute inset-0 bg-audio-gradient" />
      )}

      {bgType === "video" && !!videoUrl && (
        <video
          key={videoUrl}
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover will-change-transform"
          style={{ filter: `blur(${blurPx}px)`, transform: blurPx ? "scale(1.03)" : "none" }}
        />
      )}

      {bgType === "gif" && !!gifUrl && (
        <img
          key={gifUrl}
          src={gifUrl}
          alt="bg"
          className="absolute inset-0 h-full w-full object-cover will-change-transform"
          style={{ filter: `blur(${blurPx}px)`, transform: blurPx ? "scale(1.03)" : "none" }}
        />
      )}

      {bgType === "tunnel" && (
        <AudioTunnel
          active={true}
          analyser={analyser}
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
          analyser={analyser}
          speed={vaporSpeed}
          quality={vaporQuality}
          gridColor={vaporGridColor}
          skyTop={vaporSkyTop}
          skyBottom={vaporSkyBottom}
          skySolid={vaporSkySolid}
          skyMix={vaporSkyMix}
          sunInner={vaporSunInner}
          sunOuter={vaporSunOuter}
          sunHeight={vaporSunHeight}
          sunRadius={vaporSunRadius}
        />
      )}

      {(bgType === "video" || bgType === "gif" || bgType === "tunnel" || bgType === "vaporwave") && dimPercent > 0 && (
        <div className="absolute inset-0" style={{ background: `rgba(0,0,0, ${dimPercent / 100})` }} />
      )}
    </div>
  );
}
