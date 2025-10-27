"use client";

import { useEffect, useRef } from "react";

interface FlickeringGridProps {
  className?: string;
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  color?: string;
  width?: number;
  height?: number;
  maxOpacity?: number;
}

export function FlickeringGrid({
  className = "",
  squareSize = 4,
  gridGap = 6,
  flickerChance = 0.3,
  color = "rgb(100, 100, 100)",
  width,
  height,
  maxOpacity = 0.2,
}: FlickeringGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const squaresRef = useRef<Float32Array>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let squares: Float32Array;
    let cols = 0;
    let rows = 0;
    let canvasWidth = 0;
    let canvasHeight = 0;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvasWidth = width || rect.width;
      canvasHeight = height || rect.height;
      
      canvas.width = canvasWidth * dpr;
      canvas.height = canvasHeight * dpr;
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
      
      ctx.scale(dpr, dpr);
      
      cols = Math.floor(canvasWidth / (squareSize + gridGap));
      rows = Math.floor(canvasHeight / (squareSize + gridGap));
      
      squares = new Float32Array(cols * rows);
      squaresRef.current = squares;
    };

    const animate = () => {
      if (!ctx || !squaresRef.current) return;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      const squares = squaresRef.current;
      
      for (let i = 0; i < squares.length; i++) {
        if (Math.random() < flickerChance) {
          squares[i] = Math.random() * maxOpacity;
        }
        
        if (squares[i] > 0) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = col * (squareSize + gridGap);
          const y = row * (squareSize + gridGap);
          
          ctx.fillStyle = color.replace("rgb", "rgba").replace(")", `, ${squares[i]})`);
          ctx.fillRect(x, y, squareSize, squareSize);
          
          squares[i] *= 0.95; // Fade out
        }
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!animationRef.current) {
              animate();
            }
          } else {
            if (animationRef.current) {
              cancelAnimationFrame(animationRef.current);
              animationRef.current = undefined;
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(container);
    resizeCanvas();
    
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [squareSize, gridGap, flickerChance, color, width, height, maxOpacity]);

  return (
    <div ref={containerRef} className={`absolute inset-0 ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ zIndex: 0 }}
      />
    </div>
  );
}
