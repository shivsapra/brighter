import React from 'react';
import { BrighterLogo } from './BrighterLogo';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Illuminating your world...',
}) => {
  return (
    <div className="loading-screen-container">
      <div className="loading-content-box">
        <div className="loading-logo-halo">
          <div className="loading-starlight-pulse" />
          <BrighterLogo size="lg" showText={false} withGlow={true} />
        </div>
        <h2 className="loading-brand-name">Brighter</h2>
        <div className="loading-bar-wrapper">
          <div className="loading-bar-fill" />
        </div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
};
