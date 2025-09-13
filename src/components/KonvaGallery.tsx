// src/components/KonvaGallery.tsx
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Text, Group } from "react-konva";
import useImage from "use-image";

export type Item = {
  title: string;
  url: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};

type DraggableImgProps = {
  item: Item;
  x: number;
  y: number;
  scale: number;
  maxW: number;
  onImgNaturalSize?: (item: Item, dim: { w: number; h: number }) => void;
};

function DraggableImg({
  item,
  x,
  y,
  scale = 1,
  maxW = 480,
  onImgNaturalSize,
}: DraggableImgProps) {
  // useImage devuelve [img, status]; tipamos img como HTMLImageElement | null
  const [img] = useImage(item.url, "anonymous") as [
    HTMLImageElement | null,
    "loading" | "loaded" | "failed"
  ];
  const [hover, setHover] = useState(false);

  // Avisar al padre dimensiones naturales cuando la imagen carga
  useEffect(() => {
    if (img && typeof onImgNaturalSize === "function") {
      onImgNaturalSize(item, { w: img.width, h: img.height });
    }
  }, [img, item, onImgNaturalSize]);

  // Escala interna: respeta w/h del item; si no, limita por maxW
  const internalScale = useMemo(() => {
    if (!img) return 1;
    if (typeof item.w === "number") return (item.w * scale) / img.width;
    if (typeof item.h === "number") return (item.h * scale) / img.height;
    return Math.min(1, (maxW * scale) / img.width);
  }, [img, item.w, item.h, scale, maxW]);

  const renderedH = img ? img.height * internalScale : 0;

  return (
    <Group
      x={x}
      y={y}
      draggable
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <KonvaImage image={img ?? undefined} scaleX={internalScale} scaleY={internalScale} />
      {hover && (
        <Text
          text={item.title}
          y={renderedH + 6}
          fontSize={16}
          padding={6}
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

type FreePos = { x: number; y: number; mode: "free" };
type GridPos = { x: number; y: number; row: number; mode: "grid" };

type GalleryProps = {
  items?: Item[];
  cols?: number;
  maxW?: number;
};

export default function KonvaGallery({
  items = [],
  cols = 3,
  maxW = 480,
}: GalleryProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 });

  // Tamaños naturales reportados por los hijos
  const [naturalSizes, setNaturalSizes] = useState<
    Map<string, { w: number; h: number }>
  >(new Map());

  const handleImgNaturalSize = useCallback(
    (item: Item, dim: { w: number; h: number }) => {
      setNaturalSizes((prev) => {
        const next = new Map(prev);
        const key = item.url || item.title || JSON.stringify(item);
        next.set(key, dim);
        return next;
      });
    },
    []
  );

  // Medición responsiva del contenedor
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

  // Escala global según ancho del contenedor vs un ancho base
  const BASE_WIDTH = 2560;
  const globalScale = useMemo(
    () => Math.max(0.35, Math.min(1.1, size.w / BASE_WIDTH)),
    [size.w]
  );

  // Constantes de layout
  const padding = 20 * globalScale;
  const gapX = 40 * globalScale;
  const gapY = 40 * globalScale;
  const colW = useMemo(
    () => Math.max(240 * globalScale, size.w / cols - gapX),
    [size.w, cols, gapX, globalScale]
  );

  // Altura renderizada real estimada
  const getRenderedHeight = useCallback(
    (item: Item, nat?: { w: number; h: number }): number => {
      if (!nat) return 0;
      const { w: natW, h: natH } = nat;
      let internalScale: number;
      if (typeof item.w === "number") internalScale = (item.w * globalScale) / natW;
      else if (typeof item.h === "number")
        internalScale = (item.h * globalScale) / natH;
      else internalScale = Math.min(1, (maxW * globalScale) / natW);
      return natH * internalScale;
    },
    [globalScale, maxW]
  );

  // Posiciones: usa x/y si vienen (modo libre); si no, grilla base
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
      const y = Math.round(padding + row * gapY); // y base por fila (altura total se calcula aparte)
      return { x, y, row, mode: "grid" } as GridPos;
    });
  }, [items, cols, padding, colW, gapX, gapY, globalScale]);

  // Recalcular altura del Stage según alturas renderizadas reales
  useEffect(() => {
    if (!items.length) {
      setSize((s) => ({ ...s, h: 500 }));
      return;
    }

    const keyOf = (item: Item) => item.url || item.title || JSON.stringify(item);
    const anyFree = positions.some((p) => p.mode === "free");

    if (anyFree) {
      // Modo libre: bounding box basado en y + altura renderizada
      let maxBottom = 0;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const pos = positions[i];
        const nat = naturalSizes.get(keyOf(item));
        const rh = getRenderedHeight(item, nat);
        const labelPad = 24; // margen para el texto hover
        const bottom = ((pos as FreePos | GridPos)?.y || 0) + rh + labelPad;
        if (bottom > maxBottom) maxBottom = bottom;
      }
      const totalH = Math.max(500, Math.ceil(maxBottom + padding));
      setSize((s) => ({ ...s, h: totalH }));
      return;
    }

    // Grilla: máximo alto por fila y sumatoria
    const rowHeights = new Map<number, number>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const pos = positions[i] as GridPos;
      if (!pos || pos.mode !== "grid") continue;
      const nat = naturalSizes.get(keyOf(item));
      const rh = getRenderedHeight(item, nat);
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
            <DraggableImg
              key={`${item.title || item.url}-${i}`}
              item={item}
              scale={globalScale}
              x={positions[i].x}
              y={positions[i].y}
              maxW={maxW}
              onImgNaturalSize={handleImgNaturalSize}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
