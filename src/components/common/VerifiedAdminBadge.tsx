import React, { useState } from 'react';
import { useAdmin } from '../../context/AdminContext';

interface VerifiedAdminBadgeProps {
  userId?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export const VerifiedAdminBadge: React.FC<VerifiedAdminBadgeProps> = ({
  userId,
  size = 'sm',
  showLabel = false,
  showTooltip = true,
  className = '',
}) => {
  const { isAdminUser } = useAdmin();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  // Strictly verify that the user's ID exists in the backend-confirmed admin role list
  if (!userId || !isAdminUser(userId)) {
    return null;
  }

  // Size mapping
  const pxSizes = {
    xs: 12,
    sm: 14,
    md: 17,
    lg: 20,
  };
  const iconPx = pxSizes[size];

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showTooltip) return;
    setIsTooltipVisible((prev) => !prev);
    setTimeout(() => setIsTooltipVisible(false), 2400);
  };

  return (
    <span
      className={`verified-admin-badge-wrapper size-${size} ${className}`}
      onClick={handleTap}
      onMouseEnter={() => showTooltip && setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
      title="Verified Admin"
      role="img"
      aria-label="Verified Administrator Badge"
    >
      <span className="verified-badge-halo">
        <svg
          width={iconPx}
          height={iconPx}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="admin-badge-svg"
        >
          {/* Radiant 8-point shield / star badge */}
          <path
            d="M12 2L14.7 4.5L18.3 4.2L19.4 7.6L22.6 9.3L21.9 12.9L23.4 16.3L20.2 18.2L19.3 21.7L15.7 21.6L13.2 24.2L10.8 21.6L7.2 21.7L6.3 18.2L3.1 16.3L4.6 12.9L3.9 9.3L7.1 7.6L8.2 4.2L11.8 4.5L12 2Z"
            fill="url(#goldGradient)"
            stroke="#FDE68A"
            strokeWidth="1.2"
          />
          {/* Centered Checkmark */}
          <path
            d="M8.5 12.2L11 14.7L16 9.5"
            stroke="#08090C"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="goldGradient" x1="3" y1="2" x2="23" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FDE68A" />
              <stop offset="0.5" stopColor="#F59E0B" />
              <stop offset="1" stopColor="#D97706" />
            </linearGradient>
          </defs>
        </svg>
      </span>

      {showLabel && <span className="verified-badge-text">Admin</span>}

      {/* Floating Tooltip */}
      {showTooltip && isTooltipVisible && (
        <span className="verified-badge-tooltip" role="tooltip">
          Verified Admin
        </span>
      )}
    </span>
  );
};
