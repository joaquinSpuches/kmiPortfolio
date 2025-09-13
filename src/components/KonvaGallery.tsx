import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Text, Group } from "react-konva";
import useImage from "use-image";

export type Item = {
  title: string;
  url: string;
  type?: "image" | "video";
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  posterUrl?: string;
};

type FreePos = { x: number; y: number; mode: "free" };
type GridPos = { x: number; y: number; row: number; mode: "grid" };

type GalleryProps = {
  items?: Item[];
  cols?: number;
  maxW?: number;
};

const isVideoItem = (item: Item) => {
  const t = (item.type ?? "").toLowerCase();
  if (t === "video") return true;
  return /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*|#.*)?$/i.test(item.url);
};

type DraggableMediaProps = {
  item: Item;
  x: number;
  y: number;
  scale: number;
  maxW: number;
  onNaturalSize?: (item: Item, dim: { w: number; h: number }) => void;
};

function DraggableMedia({
  item,
  x,
  y,
  scale,
  maxW,
  onNaturalSize,
}: DraggableMediaProps) {
  const isVideo = isVideoItem(item);
  const [hover, setHover] = useState(false);

  const [img] = useImage(!isVideo ? item.url : "", "anonymous") as [
    HTMLImageElement | null,
    "loading" | "loaded" | "failed"
  ];

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<any>(null);
  const [videoMeta, setVideoMeta] = useState<{ w: number; h: number } | null>(null);
  const [hasFirstFrame, setHasFirstFrame] = useState(false);

  useEffect(() => {
    if (!isVideo) return;

    if (typeof window === "undefined") return;
    const el = document.createElement("video");
    videoRef.current = el;

    el.preload = "auto";
    el.muted = item.muted ?? true;
    (el as any).playsInline = true;
    (el as any).webkitPlaysInline = true;
    el.loop = item.loop ?? true;
    if (item.posterUrl) el.poster = item.posterUrl;

    const onMeta = () => {
      const w = el.videoWidth || 0;
      const h = el.videoHeight || 0;
      setVideoMeta({ w, h });
      onNaturalSize?.(item, { w, h });
    };
    const onLoadedData = () => {
      setHasFirstFrame(true);
      imageRef.current?.getLayer()?.batchDraw();
    };
    const onTimeUpdate = () => imageRef.current?.getLayer()?.batchDraw();

    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("loadeddata", onLoadedData);
    el.addEventListener("timeupdate", onTimeUpdate);

    el.src = item.url;

    el.play().catch(() => {});

    let raf = 0;
    const tick = () => {
      imageRef.current?.getLayer()?.batchDraw();
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      el.pause();
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("loadeddata", onLoadedData);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeAttribute("src");
      el.load();
      videoRef.current = null;
      setHasFirstFrame(false);
      setVideoMeta(null);
    };
  }, [isVideo, item.url, item.muted, item.loop, item.posterUrl, onNaturalSize, item]);

  const baseW = isVideo ? videoMeta?.w ?? 0 : img?.width ?? 0;
  const baseH = isVideo ? videoMeta?.h ?? 0 : img?.height ?? 0;

  const internalScale = useMemo(() => {
    if (!baseW || !baseH) return 1;
    if (typeof item.w === "number") return (item.w * scale) / baseW;
    if (typeof item.h === "number") return (item.h * scale) / baseH;
    return Math.min(1, (maxW * scale) / baseW);
  }, [baseW, baseH, item.w, item.h, scale, maxW]);

  const renderedH = baseH * internalScale;

  useEffect(() => {
    if (!isVideo && img && onNaturalSize) {
      onNaturalSize(item, { w: img.width, h: img.height });
    }
  }, [isVideo, img, item, onNaturalSize]);

  const handleTogglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  return (
    <Group
      x={x}
      y={y}
      draggable
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={isVideo ? handleTogglePlay : undefined}
    >
      <KonvaImage
        ref={imageRef}
        image={isVideo ? (videoRef.current ?? undefined) : img ?? undefined}
        scaleX={internalScale}
        scaleY={internalScale}
      />
      {hover && (
        <Text
          text={item.title}
          y={(renderedH || 0) + 6}
          fontSize={16}
          padding={6}
          fill="white"
          shadowColor="black"
          shadowBlur={4}
          shadowOpacity={0.6}
          listening={false}
        />
      )}
      {isVideo && !hasFirstFrame && (
        <Text
          text="tocar para reproducir"
          y={24}
          fontSize={14}
          fill="white"
          shadowColor="black"
          shadowBlur={4}
          shadowOpacity={0.6}
          listening={false}
        />
      )}
    </Group>
  );
}

export default function KonvaGallery({
  items = [],
  cols = 3,
  maxW = 480,
}: GalleryProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 });

  const [naturalSizes, setNaturalSizes] = useState<Map<string, { w: number; h: number }>>(
    new Map()
  );

  const handleNaturalSize = useCallback((item: Item, dim: { w: number; h: number }) => {
    setNaturalSizes((prev) => {
      const next = new Map(prev);
      const key = item.url || item.title || JSON.stringify(item);
      next.set(key, dim);
      return next;
    });
  }, []);

  useEffect(() => {
    function measure() {
      if (!containerRef.current) return;
      const { clientWidth } = containerRef.current;
      setSize((s) => ({ ...s, w: clientWidth }));
    }
    measure();
    const obs = new ResizeObserver(measure);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const BASE_WIDTH = 2560;
  const globalScale = useMemo(
    () => Math.max(0.35, Math.min(1.1, size.w / BASE_WIDTH)),
    [size.w]
  );

  const padding = 20 * globalScale;
  const gapX = 40 * globalScale;
  const gapY = 40 * globalScale;
  const colW = useMemo(
    () => Math.max(240 * globalScale, size.w / cols - gapX),
    [size.w, cols, gapX, globalScale]
  );

  const positions = useMemo<(FreePos | GridPos)[]>(() => {
    return items.map((item, i) => {
      if (typeof item.x === "number" || typeof item.y === "number") {
        return {
          x: Math.round((item.x ?? 0) * globalScale),
          y: Math.round((item.y ?? 0) * globalScale),
          mode: "free",
        } as FreePos;
      }
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = Math.round(padding + col * (colW + gapX));
      const y = Math.round(padding + row * gapY);
      return { x, y, row, mode: "grid" } as GridPos;
    });
  }, [items, cols, padding, colW, gapX, gapY, globalScale]);

  const getRenderedHeight = useCallback(
    (item: Item, nat?: { w: number; h: number }) => {
      if (!nat) return 0;
      const natW = nat.w;
      const natH = nat.h;
      let internalScale: number;
      if (typeof item.w === "number") internalScale = (item.w * globalScale) / natW;
      else if (typeof item.h === "number") internalScale = (item.h * globalScale) / natH;
      else internalScale = Math.min(1, (maxW * globalScale) / natW);
      return natH * internalScale;
    },
    [globalScale, maxW]
  );

  useEffect(() => {
    if (!items.length) {
      setSize((s) => ({ ...s, h: 500 }));
      return;
    }

    const keyOf = (it: Item) => it.url || it.title || JSON.stringify(it);
    const anyFree = positions.some((p) => p.mode === "free");

    if (anyFree) {
      let maxBottom = 0;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const pos = positions[i];
        const nat = naturalSizes.get(keyOf(it));
        const rh = getRenderedHeight(it, nat);
        const labelPad = 24;
        const bottom = ((pos as FreePos | GridPos)?.y || 0) + rh + labelPad;
        if (bottom > maxBottom) maxBottom = bottom;
      }
      const totalH = Math.max(500, Math.ceil(maxBottom + padding));
      setSize((s) => ({ ...s, h: totalH }));
      return;
    }

    const rowHeights = new Map<number, number>();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const pos = positions[i] as GridPos;
      if (!pos || pos.mode !== "grid") continue;
      const nat = naturalSizes.get(keyOf(it));
      const rh = getRenderedHeight(it, nat);
      const current = rowHeights.get(pos.row) || 0;
      rowHeights.set(pos.row, Math.max(current, rh));
    }

    const rows = Array.from(rowHeights.keys()).sort((a, b) => a - b);
    const sumHeights = rows.reduce((acc, r) => acc + (rowHeights.get(r) || 0), 0);
    const totalGaps = Math.max(0, rows.length - 1) * gapY;
    const labelPadPerRow = rows.length * 24;
    const totalH = Math.max(
      500,
      Math.ceil(padding + sumHeights + totalGaps + labelPadPerRow + padding)
    );

    setSize((s) => ({ ...s, h: totalH }));
  }, [items, positions, naturalSizes, getRenderedHeight, gapY, padding]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <Stage width={size.w} height={size.h}>
        <Layer>
          {items.map((item, i) => (
            <DraggableMedia
              key={`${item.title || item.url}-${i}`}
              item={item}
              scale={globalScale}
              x={positions[i].x}
              y={positions[i].y}
              maxW={maxW}
              onNaturalSize={handleNaturalSize}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}