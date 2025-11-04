import { useEffect, useRef } from "react";
import {
  WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry,
  Mesh, ShaderMaterial, Vector2, Vector3
} from "three";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

type Props = {
  active: boolean;
  analyser: any;
  speed: number;
  quality: number;
  gridColor: string;
  skyTop: string;
  skyBottom: string;
  skySolid: string;
  skyMix: number;
  sunInner: string;
  sunOuter: string;
  sunHeight: number;   // 0..1
  sunRadius: number;   // 0.15..0.6
};

export default function Vaporwave({
  active, analyser, speed, quality,
  gridColor, skyTop, skyBottom, skySolid, skyMix,
  sunInner, sunOuter, sunHeight, sunRadius
}: Props) {
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
    renderer.setPixelRatio(pr);
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 20);
    camera.position.z = 1;

    const geom = new PlaneGeometry(2, 2);
    const gc = hexToRgb(gridColor);
    const st = hexToRgb(skyTop);
    const sb = hexToRgb(skyBottom);
    const ss = hexToRgb(skySolid);
    const si = hexToRgb(sunInner);
    const so = hexToRgb(sunOuter);

    const mat = new ShaderMaterial({
      uniforms: {
        uTime:    { value: 0 },
        uRes:     { value: new Vector2(el.clientWidth, el.clientHeight) },
        uEnergy:  { value: 0 },
        uSpeed:   { value: speed },
        uQual:    { value: quality },
        uGrid:    { value: new Vector3(gc.r/255, gc.g/255, gc.b/255) },
        uSkyTop:  { value: new Vector3(st.r/255, st.g/255, st.b/255) },
        uSkyBot:  { value: new Vector3(sb.r/255, sb.g/255, sb.b/255) },
        uSkySolid:{ value: new Vector3(ss.r/255, ss.g/255, ss.b/255) },
        uSkyMix:  { value: skyMix },
        uSunIn:   { value: new Vector3(si.r/255, si.g/255, si.b/255) },
        uSunOut:  { value: new Vector3(so.r/255, so.g/255, so.b/255) },
        uSunY01:  { value: sunHeight },
        uSunR:    { value: sunRadius },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform vec2  uRes;
        uniform float uTime, uEnergy, uSpeed, uQual;
        uniform vec3  uGrid, uSkyTop, uSkyBot, uSkySolid, uSunIn, uSunOut;
        uniform float uSkyMix, uSunY01, uSunR;

        float sat(float x){ return clamp(x,0.0,1.0); }
        float lineAA(float coord, float width){
          float f = abs(fract(coord) - 0.5);
          float fw = fwidth(coord);
          return 1.0 - smoothstep(width, width + fw, f);
        }

        vec3 sun(vec2 uv){
          vec2 p = uv*2.0-1.0;
          p.x *= uRes.x/uRes.y;
          float cy = mix(-0.2, 0.9, sat(uSunY01));
          vec2  c  = vec2(0.0, cy);
          float r  = length(p - c);
          float ring = smoothstep(uSunR+0.02, uSunR-0.02, r);
          float t    = smoothstep(0.0, uSunR, (uSunR - r));
          vec3  col  = mix(uSunOut, uSunIn, t);
          float scan  = smoothstep(0.48, 0.5, sin(uv.y*800.0 + uTime*4.0))*0.25;
          float pulse = 0.3*uEnergy;
          return col * ring * (1.0 - scan + pulse);
        }

        float H(vec2 xz, float t){
          float ampBase = mix(0.20, 0.45, sat(uEnergy*0.9));
          float a1 = ampBase;
          float a2 = ampBase*0.6;
          float k1 = 1.2,  w1 = 1.2 + 1.2*uSpeed;
          float k2 = 0.8,  w2 = 0.8 + 0.9*uSpeed;
          float p  = 0.35*sin(0.25*xz.x + t*0.4);
          float h1 = a1 * sin(k1*(xz.y + p) + t*w1);
          float h2 = a2 * sin(k2*(1.4*xz.x + 0.8*xz.y) + t*w2);
          return h1 + h2;
        }
        vec3 Hn(vec3 p, float t){
          float e = 0.01;
          float h0 = H(p.xz, t);
          float hx = H(vec2(p.x+e,p.z), t) - h0;
          float hz = H(vec2(p.x,p.z+e), t) - h0;
          return normalize(vec3(-hx, 1.0, -hz));
        }
        bool rayHit(vec3 ro, vec3 rd, out vec3 pos){
          float q = sat((uQual - 0.75) / (2.0 - 0.75));
          int   STEPS = int(mix(14.0, 34.0, q));
          float DT    = mix(0.10, 0.05, q);
          float t = 0.0;
          for(int i=0;i<64;i++){
            vec3 p = ro + rd*t;
            float d = p.y - H(p.xz, uTime);
            if (d <= 0.0){
              float a = t - DT, b = t;
              for(int j=0;j<6;j++){
                float m = 0.5*(a+b);
                vec3  pm = ro + rd*m;
                float dm = pm.y - H(pm.xz, uTime);
                if (dm > 0.0) a = m; else b = m;
              }
              pos = ro + rd*b; return true;
            }
            t += DT + 0.02*float(i);
            if (i>STEPS || t>30.0) break;
          }
          return false;
        }
        vec2 gridMask(vec3 p){
          float gx = p.x / 1.10;
          float gz = p.z / 0.85;
          float nearT = sat(1.0 - 0.04*max(p.z, 0.0));
          float wH = mix(0.010, 0.060, nearT);
          float wV = mix(0.008, 0.040, nearT);
          float lh = lineAA(gz, wH);
          float lv = lineAA(gx, wV)*0.6;
          return vec2(lh, lv);
        }

        void main(){
          float aspect = uRes.x/uRes.y;
          vec2  p = vUv*2.0 - 1.0;
          p.x *= aspect;

          vec3 ro = vec3(0.0, 0.9, -2.8);
          vec3 rd = normalize(vec3(p.x, p.y*0.9, 1.6));

          vec3 skyGrad = mix(uSkyBot, uSkyTop, sat(smoothstep(-0.2, 1.0, vUv.y)));
          vec3 sky = mix(skyGrad, uSkySolid, clamp(uSkyMix, 0.0, 1.0));

          vec3 s = sun(vUv);
          float horizonHaze = smoothstep(0.40, 0.55, vUv.y) * (0.25 + 0.35*uEnergy);
          vec3 col = sky + s;

          vec3 hitPos; bool hit=false;
          if (rd.y < 0.0) hit = rayHit(ro, rd, hitPos);
          if (hit){
            vec3 n = Hn(hitPos, uTime);
            vec3 L = normalize(vec3(0.0, 0.7, 1.0));
            float ndl = clamp(dot(n, L),0.0,1.0);
            float dif = 0.35 + 0.65*ndl;

            vec3 V = normalize(-rd);
            vec3 R = reflect(-L, n);
            float spec = pow(clamp(dot(R, V),0.0,1.0), mix(16.0, 36.0, 0.5 + 0.5*uEnergy)) * (0.15 + 0.25*uEnergy);

            vec2 g = gridMask(hitPos);
            float grid = clamp(g.x + g.y,0.0,1.0);
            vec3 base = uGrid * (0.85 + 0.55*uEnergy);

            float dist = length(hitPos - ro);
            float fog  = clamp(smoothstep(6.0, 18.0, dist),0.0,1.0);

            vec3 surf = base * (0.55 + 0.45*grid) * dif + spec*vec3(1.0,0.9,1.0);
            surf *= (1.0 - fog);
            col += surf;
          }

          col += vec3(1.0, 0.5, 0.9) * horizonHaze * 0.20;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const quad = new Mesh(geom, mat);
    scene.add(quad);

    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      (mat.uniforms.uRes.value as Vector2).set(w, h);
      camera.aspect = w/h; camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    let start = performance.now();
    renderer.setAnimationLoop(() => {
      const t = (performance.now() - start)/1000;
      (mat.uniforms.uTime.value as number)   = t;
      (mat.uniforms.uSpeed.value as number)  = speed;
      (mat.uniforms.uQual.value as number)   = quality;
      (mat.uniforms.uSunY01.value as number) = sunHeight;
      (mat.uniforms.uSunR.value as number)   = sunRadius;
      (mat.uniforms.uSkyMix.value as number) = skyMix;

      if (analyser) {
        const arr = analyser.getValue() as Float32Array;
        let sum = 0; let n = 0;
        for (let i = 0; i < arr.length; i += 4) { sum += arr[i]; n++; }
        const db = sum / Math.max(1, n);
        const v = Math.min(1, Math.max(0, (db + 100) / 100));
        const prev = mat.uniforms.uEnergy.value as number;
        mat.uniforms.uEnergy.value = prev * 0.85 + v * 0.15;
      }

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
  }, [active, analyser, speed, quality, gridColor, skyTop, skyBottom, skySolid, skyMix, sunInner, sunOuter, sunHeight, sunRadius]);

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
    const ss = hexToRgb(skySolid);
    const si = hexToRgb(sunInner);
    const so = hexToRgb(sunOuter);
    (mat.uniforms.uGrid.value as Vector3).set(gc.r/255, gc.g/255, gc.b/255);
    (mat.uniforms.uSkyTop.value as Vector3).set(st.r/255, st.g/255, st.b/255);
    (mat.uniforms.uSkyBot.value as Vector3).set(sb.r/255, sb.g/255, sb.b/255);
    (mat.uniforms.uSkySolid.value as Vector3).set(ss.r/255, ss.g/255, ss.b/255);
    (mat.uniforms.uSunIn.value as Vector3).set(si.r/255, si.g/255, si.b/255);
    (mat.uniforms.uSunOut.value as Vector3).set(so.r/255, so.g/255, so.b/255);
  }, [gridColor, skyTop, skyBottom, skySolid, sunInner, sunOuter]);

  return <div ref={containerRef} className="tunnel-container" />;
}
