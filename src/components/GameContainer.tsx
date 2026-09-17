import React from 'react';
import { useOrientation } from '../hooks/useOrientation';

interface GameContainerProps {
  children: React.ReactNode;
  className?: string;
  enforceAspectBounds?: boolean;
}

/**
 * GameContainer: Universal responsive wrapper ensuring optimal fitting across
 * portrait, landscape, desktop, and notch-equipped mobile displays.
 */
export const GameContainer: React.FC<GameContainerProps> = ({
  children,
  className = '',
  enforceAspectBounds = true,
}) => {
  const { isLandscape } = useOrientation();

  return (
    <div
      className={`w-full max-w-full h-full flex flex-col justify-between overflow-hidden select-none box-border ${
        isLandscape ? 'orientation-landscape landscape-safe-insets' : 'orientation-portrait'
      } ${className}`}
      style={{
        paddingLeft: isLandscape ? 'max(env(safe-area-inset-left, 0px), 8px)' : '4px',
        paddingRight: isLandscape ? 'max(env(safe-area-inset-right, 0px), 8px)' : '4px',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)',
        ...(enforceAspectBounds && isLandscape
          ? {
              maxWidth: 'min(100vw, calc(100dvh * (16 / 9)))',
              margin: '0 auto',
            }
          : {}),
      }}
    >
      {children}
    </div>
  );
};
