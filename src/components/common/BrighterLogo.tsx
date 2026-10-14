import React from 'react';

interface BrighterLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  withGlow?: boolean;
  className?: string;
  onClick?: () => void;
}

export const BrighterLogo: React.FC<BrighterLogoProps> = ({
  size = 'md',
  showText = true,
  withGlow = true,
  className = '',
  onClick,
}) => {
  const sizeMap = {
    sm: { icon: 32, font: '1.25rem', star: 14 },
    md: { icon: 44, font: '1.65rem', star: 18 },
    lg: { icon: 64, font: '2.25rem', star: 26 },
    xl: { icon: 96, font: '3.25rem', star: 38 },
  };

  const current = sizeMap[size];

  return (
    <div
      onClick={onClick}
      className={`brighter-logo-wrapper ${onClick ? 'clickable' : ''} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? '8px' : size === 'xl' ? '18px' : '12px',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div
        className={`logo-icon-container ${withGlow ? 'logo-glow-effect' : ''}`}
        style={{
          width: current.icon,
          height: current.icon,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          width={current.icon}
          height={current.icon}
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            <linearGradient id={`logoGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF4CF" />
              <stop offset="35%" stopColor="#FFD15C" />
              <stop offset="85%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id={`starGrad-${size}`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="50%" stopColor="#FFE8A3" />
              <stop offset="100%" stopColor="#FFFFFF" />
            </linearGradient>
            <filter id={`softGlow-${size}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Monogram BS Base Paths */}
          <g filter={`url(#softGlow-${size})`}>
            {/* Left Stem */}
            <line
              x1="28"
              y1="22"
              x2="28"
              y2="78"
              stroke={`url(#logoGrad-${size})`}
              strokeWidth="7"
              strokeLinecap="round"
            />
            {/* Top Loop 'B' */}
            <path
              d="M 28 22 H 54 C 67 22 74 30 74 40 C 74 49 67 52 57 52 H 30"
              fill="none"
              stroke={`url(#logoGrad-${size})`}
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Bottom Loop & Swoop 'S' interlocking */}
            <path
              d="M 50 52 C 67 52 74 58 74 66 C 74 76 64 78 50 78 H 28"
              fill="none"
              stroke={`url(#logoGrad-${size})`}
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Radiant 5-Point Brighter Creator Star */}
          <g transform="translate(68, 38)" className="pulsing-starlight">
            <path
              d="M 0 -13.5 L 3.9 -4.2 L 13.5 -4.2 L 5.8 1.8 L 8.4 11.2 L 0 5.4 L -8.4 11.2 L -5.8 1.8 L -13.5 -4.2 L -3.9 -4.2 Z"
              fill={`url(#starGrad-${size})`}
            />
            <circle cx="0" cy="0" r="2.4" fill="#FFFFFF" />
          </g>

          {/* Micro Accent Star */}
          <g transform="translate(32, 74)">
            <path
              d="M 0 -6 L 1.7 -1.9 L 6 -1.9 L 2.6 0.8 L 3.7 5 L 0 2.4 L -3.7 5 L -2.6 0.8 L -6 -1.9 L -1.7 -1.9 Z"
              fill="#FFFFFF"
              opacity="0.85"
            />
          </g>
        </svg>
      </div>

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span
            className="brighter-brand-text"
            style={{
              fontSize: current.font,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            Brighter
          </span>
        </div>
      )}
    </div>
  );
};
