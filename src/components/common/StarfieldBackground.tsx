import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface StarfieldBackgroundProps {
  density?: number;
  speed?: number;
}

export const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  density = 45,
  speed = 0.35,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    };

    window.addEventListener('resize', handleResize);

    interface Star {
      x: number;
      y: number;
      radius: number;
      alpha: number;
      alphaSpeed: number;
      vy: number;
      vx: number;
      isSparkle: boolean;
      sparkleAngle: number;
      color: string;
    }

    let stars: Star[] = [];

    const isDark = theme === 'dark';

    const starColorsDark = [
      'rgba(255, 244, 215, ', // warm ivory starlight
      'rgba(255, 209, 92, ',  // starlight gold
      'rgba(245, 158, 11, ',  // warm amber
      'rgba(255, 255, 255, ', // platinum white
    ];

    const starColorsLight = [
      'rgba(217, 119, 6, ',  // amber
      'rgba(234, 179, 8, ',  // warm gold
      'rgba(140, 148, 160, ',// neutral slate
    ];

    const colors = isDark ? starColorsDark : starColorsLight;

    const initStars = () => {
      stars = [];
      const count = Math.floor((width * height) / 18000) * (density / 40);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 1.6 + 0.5,
          alpha: Math.random() * 0.7 + 0.2,
          alphaSpeed: (Math.random() * 0.015 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
          vy: -(Math.random() * speed + 0.1),
          vx: (Math.random() - 0.5) * 0.15,
          isSparkle: Math.random() > 0.8,
          sparkleAngle: Math.random() * Math.PI,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    initStars();

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Subtle ambient radiant glow spots in corners
      if (isDark) {
        const gradTop = ctx.createRadialGradient(width * 0.5, -50, 10, width * 0.5, 0, width * 0.65);
        gradTop.addColorStop(0, 'rgba(255, 209, 92, 0.045)');
        gradTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradTop;
        ctx.fillRect(0, 0, width, height);
      }

      // Draw and update stars
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // Twinkle
        star.alpha += star.alphaSpeed;
        if (star.alpha > 0.95 || star.alpha < 0.15) {
          star.alphaSpeed = -star.alphaSpeed;
        }

        // Float upwards like soft starlight trails
        star.y += star.vy;
        star.x += star.vx;

        // Wrap around
        if (star.y < 0) {
          star.y = height + 10;
          star.x = Math.random() * width;
        }
        if (star.x < 0) star.x = width;
        if (star.x > width) star.x = 0;

        ctx.save();
        ctx.fillStyle = `${star.color}${star.alpha})`;
        ctx.shadowColor = isDark ? 'rgba(255, 209, 92, 0.4)' : 'rgba(217, 119, 6, 0.3)';
        ctx.shadowBlur = star.radius * 3;

        if (star.isSparkle && star.radius > 1.2) {
          // Radiant celestial starlight ray with luminous core
          const len = star.radius * 2.8;
          const thick = Math.max(0.6, star.radius * 0.4);
          ctx.translate(star.x, star.y);
          ctx.beginPath();
          // Vertical diffraction ray
          ctx.ellipse(0, 0, thick, len, 0, 0, Math.PI * 2);
          // Horizontal diffraction ray
          ctx.ellipse(0, 0, len, thick, 0, 0, Math.PI * 2);
          // Core bright center
          ctx.arc(0, 0, star.radius * 0.9, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Round starlight particle
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, density, speed]);

  return (
    <canvas
      ref={canvasRef}
      className="starfield-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};
