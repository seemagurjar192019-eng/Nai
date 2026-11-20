'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';

export interface MunimOrbProps {
  size?: 'dock' | 'mini';
  onClick?: () => void;
  ariaLabel?: string;
}

export const MunimOrb: React.FC<MunimOrbProps> = ({
  size = 'dock',
  onClick,
  ariaLabel = 'Open Bolne Wala Munim Voice Entry',
}) => {
  const isDock = size === 'dock';
  const dim = isDock ? 'w-[58px] h-[58px]' : 'w-12 h-12';
  const iconDim = isDock ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <div className="relative inline-flex items-center justify-center select-none">
      {/* Concentric 2.5s Ripple Rings */}
      <span
        aria-hidden="true"
        className={`munim-ripple-1 absolute inset-0 rounded-full border-2 border-[#06B6D4] pointer-events-none`}
      />
      <span
        aria-hidden="true"
        className={`munim-ripple-2 absolute inset-0 rounded-full border-2 border-[#4F46E5] pointer-events-none`}
      />

      {/* Ambient Indigo-Cyan Aura Glow */}
      <span
        aria-hidden="true"
        style={{
          background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
        }}
        className="orb-aura-pulse absolute -inset-1 rounded-full blur-[6px] pointer-events-none"
      />

      {/* Stationary Tap Target + Continuous Levitating Inner 3D Blue-Cyan Mic Sphere */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.91, y: 2 }}
        whileHover={{ scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 460, damping: 24 }}
        onClick={onClick}
        aria-label={ariaLabel}
        className={`relative ${dim} rounded-full flex items-center justify-center cursor-pointer focus:outline-none`}
      >
        <motion.span
          animate={{ y: [-3, 3, -3] }}
          transition={{
            type: 'tween',
            duration: 2.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            background:
              'radial-gradient(circle at 30% 25%, #67E8F9 0%, #06B6D4 28%, #4F46E5 82%, #3730A3 100%)',
            boxShadow:
              '0 12px 26px -4px rgba(79, 70, 229, 0.55), inset 0 2px 3px rgba(255, 255, 255, 0.45)',
          }}
          className={`relative w-full h-full rounded-full text-white flex items-center justify-center ${
            isDock
              ? 'ring-[5px] ring-[#F6F7FB] dark:ring-[#09090B]'
              : 'ring-2 ring-[var(--surface)]'
          }`}
        >
          {/* Crisp 3D Upper Specular Highlight */}
          <span
            aria-hidden="true"
            className="absolute top-1.5 left-2.5 w-5 h-2 rounded-full bg-[#67E8F9] -rotate-25 pointer-events-none"
          />
          <Mic className={`${iconDim} relative z-10 stroke-[2.4]`} />
        </motion.span>
      </motion.button>
    </div>
  );
};
