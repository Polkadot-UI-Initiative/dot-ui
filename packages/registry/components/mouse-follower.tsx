"use client";

import { useEffect, useState } from "react";

interface DotPosition {
  x: number;
  y: number;
}

const polkadotColors = [
  "#ff2670", // polkadot-pink
  "#7916f3", // polkadot-violet
  "#07ffff", // polkadot-cyan
  "#e4ff07", // polkadot-lime
  "#ff2670", // polkadot-pink again
];

// const dampingFactors = [0.15, 0.12, 0.09, 0.06, 0.03];
const dampingFactors = [0.3, 0.2, 0.1];

export function MouseFollower() {
  const [mousePosition, setMousePosition] = useState<DotPosition>({
    x: 0,
    y: 0,
  });
  const [dotPositions, setDotPositions] = useState<DotPosition[]>(
    Array(3).fill({ x: 0, y: 0 })
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  useEffect(() => {
    let animationId: number;

    const animate = () => {
      setDotPositions((prevPositions) => {
        const newPositions = [...prevPositions];

        // First dot follows mouse position
        const targetX = mousePosition.x;
        const targetY = mousePosition.y;

        newPositions[0] = {
          x:
            newPositions[0].x +
            (targetX - newPositions[0].x) * dampingFactors[0],
          y:
            newPositions[0].y +
            (targetY - newPositions[0].y) * dampingFactors[0],
        };

        // Other dots follow the previous dot
        for (let i = 1; i < 3; i++) {
          const prevDot = newPositions[i - 1];
          newPositions[i] = {
            x:
              newPositions[i].x +
              (prevDot.x - newPositions[i].x) * dampingFactors[i] * 0.8,
            y:
              newPositions[i].y +
              (prevDot.y - newPositions[i].y) * dampingFactors[i] * 0.8,
          };
        }

        return newPositions;
      });

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [mousePosition]);

  return (
    <div className="fixed inset-0 pointer-events-none -z-10">
      {dotPositions.map((position, index) => (
        <div
          key={index}
          className="absolute w-2 h-2 rounded-full transition-opacity duration-300"
          style={{
            left: position.x - 5,
            top: position.y - 5,
            backgroundColor: polkadotColors[index],
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}
