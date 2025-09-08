    // src/components/KonvaGallery.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { Stage, Layer, Image as KonvaImage, Text, Group } from "react-konva";
import useImage from "use-image";

function DraggableImg({ item, x, y, maxW = 480 }) {
  const [img] = useImage(item.url, "anonymous");
  const [hover, setHover] = useState(false);

  // Calculamos escala para no exceder maxW
const scale = useMemo(() => {
  if (!img) return 1;
  if (item.w) return item.w / img.width;
  if (item.h) return item.h / img.height;
  return 1;
}, [img, item.w, item.h]);

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
          y={img ? img.height * scale + 6 : 6}
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

export default function KonvaGallery({ items = [] }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  // Hace el canvas responsivo al ancho del contenedor
  useEffect(() => {
    function measure() {
      if (!containerRef.current) return;
      const { clientWidth } = containerRef.current;
      // Altura “galería”; podés ajustarla o calcular por filas
      setSize({ w: clientWidth, h: Math.max(700, Math.ceil(items.length / 3) * 420) });
    }
    measure();
    const obs = new ResizeObserver(measure);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [items.length]);

  // Posiciones iniciales en grilla simple (3 columnas)
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
            <DraggableImg key={item.title + i}  item={item} x={item.x ?? 50} y={item.y ?? 50} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
