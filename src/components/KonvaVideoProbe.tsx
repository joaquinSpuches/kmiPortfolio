import { Stage, Layer, Image as KonvaImage } from "react-konva";
import { useEffect, useMemo, useRef, useState } from "react";

export default function KonvaVideoProbe() {
  const layerRef = useRef<any>(null);
  const [meta, setMeta] = useState({ w: 640, h: 360 });

  // creamos el elemento <video> una sola vez
  const video = useMemo(() => document.createElement("video"), []);

  useEffect(() => {
    const el = video;

    // setear flags ANTES del src mejora autoplay en móviles
    el.preload = "auto";
    el.muted = true;                 // autoplay suele requerir muted
    (el as any).playsInline = true;  // iOS
    (el as any).webkitPlaysInline = true;
    // si es mismo origen, no pongas crossOrigin

    // eventos útiles para debug
    const onMeta = () => {
      console.log("loadedmetadata", el.videoWidth, el.videoHeight);
      setMeta({
        w: el.videoWidth || 640,
        h: el.videoHeight || 360,
      });
    };
    const onLoadedData = () => {
      console.log("loadeddata (primer frame)");
      layerRef.current?.batchDraw(); // fuerza el primer dibujado
    };
    const onPlay = () => console.log("play");
    const onPause = () => console.log("pause");
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("loadeddata", onLoadedData);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);

    // asignar src y tratar de reproducir
    el.src = "/proyectos/ronpe99.mp4";
    el.loop = true;
    el.play().catch((e) => {
      console.warn("autoplay bloqueado:", e);
      // tocá el canvas para reproducir si pasa esto
    });

    // animación para ir redibujando frames
    let raf = 0;
    const tick = () => {
      layerRef.current?.batchDraw();
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      el.pause();
      el.removeAttribute("src");
      el.load();
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("loadeddata", onLoadedData);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [video]);

  // click para play/pause si el autoplay fue bloqueado
  const toggle = () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  return (
    <div onClick={toggle} style={{ cursor: "pointer" }}>
      <Stage width={meta.w} height={meta.h}>
        <Layer ref={layerRef}>
          <KonvaImage image={video} />
        </Layer>
      </Stage>
      <small>clic para play/pause (si el autoplay fue bloqueado)</small>
    </div>
  );
}
