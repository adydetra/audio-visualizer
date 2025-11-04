import { useEffect, useRef } from "react";
import {
  WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry,
  Mesh, ShaderMaterial, Vector2, Vector3, Color
} from "three";

function hexToRgb(hex: string){const h=hex.replace("#","");const b=parseInt(h.length===3?h.split("").map(c=>c+c).join(""):h,16);return{r:(b>>16)&255,g:(b>>8)&255,b:b&255};}

type Props = {
  active: boolean;
  analyser: any;
  speed: number; swirl: number; density: number; quality: number;
  lowColor: string; highColor: string;
};

export default function AudioTunnel({ active, analyser, speed, swirl, density, quality, lowColor, highColor }: Props){
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

    rendererRef.current = renderer;
    materialRef.current = material;

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
