// src/components/KonvaGallery.tsx
import { useEffect, useRef, useState, useMemo } from "react";
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
  maxW?: number;
};

function DraggableImg({ item, x, y, maxW = 480 }: DraggableImgProps) {
  // Tipamos el retorno de useImage para evitar "any"
const [img, status] = useImage(item.url, "anonymous");

  const [hover, setHover] = useState(false);

  // Escala según item.w / item.h (si existen). Si no, 1.
  // (Si querés limitar por maxW, se puede agregar fácilmente)
  const scale = useMemo(() => {
    if (!img) return 1;
    if (typeof item.w === "number") return item.w / img.width;
    if (typeof item.h === "number") return item.h / img.height;
    return 1;
  }, [img, item.w, item.h]);

  const renderedH = img ? img.height * scale : 0;

  return (
    <Group
      x={x}
      y={y}
      draggable
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <KonvaImage image={img} scaleX={scale} scaleY={scale} />
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

type GalleryProps = {
  items?: Item[];
};

export default function KonvaGallery({ items = [] }: GalleryProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 });

  // Responsivo al ancho del contenedor
  useEffect(() => {
    function measure() {
      if (!containerRef.current) return;
      const { clientWidth } = containerRef.current;
      // Altura base “galería”; podés ajustarla o calcular dinámico por filas
      setSize({
        w: clientWidth,
        h: Math.max(700, Math.ceil(items.length / 3) * 420),
      });
    }
    measure();
    const obs = new ResizeObserver(measure);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [items.length]);

  // Grilla simple (3 columnas): se usa de fallback si el item no trae x/y
  const positions = useMemo(() => {
    const gapX = 40;
    const gapY = 40;
    const colW = Math.max(300, size.w / 3 - gapX);
    return items.map((_, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 20 + col * (colW + gapX);
      const y = 20 + row * (360 + gapY);
      return { x, y };
    });
  }, [items, size.w]);

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      <Stage width={size.w} height={size.h}>
        <Layer>
          {items.map((item, i) => (
            <DraggableImg
              key={`${item.title}-${i}`}
              item={item}
              // Si el item trae x/y, usamos eso; si no, usamos la grilla calculada
              x={typeof item.x === "number" ? item.x : positions[i]?.x ?? 50}
              y={typeof item.y === "number" ? item.y : positions[i]?.y ?? 50}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
