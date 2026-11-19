interface NanoCharacterProps {
  size?: number;
  mood?: 'happy' | 'helpful';
  animate?: boolean;
  className?: string;
}

/**
 * NANO — MEDRADAR's minimal, modern medical-tech character.
 * Uses only matte black, emerald green, and crisp white with subtle eye-blinking animation.
 */
export function NanoCharacter({
  size = 38,
  mood = 'happy',
  animate = true,
  className = '',
}: NanoCharacterProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`${animate ? 'nano-float' : ''} ${className}`}
    >
      {/* Subtle Top Med-Sensor Antenna */}
      <line x1="24" y1="4.5" x2="24" y2="9" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="24" cy="4" r="2.2" fill="#34D399" />

      {/* Crisp Outer White Frame & Matte Black Head */}
      <rect x="7" y="9" width="34" height="31" rx="13" fill="#09090B" stroke="#10B981" strokeWidth="2" />

      {/* Side Acoustic Ear Cushions */}
      <rect x="4" y="20" width="3.5" height="9" rx="1.75" fill="#10B981" />
      <rect x="40.5" y="20" width="3.5" height="9" rx="1.75" fill="#10B981" />

      {/* Inner Visor Faceplate */}
      <rect x="11.5" y="14" width="25" height="20" rx="8.5" fill="#18181B" stroke="#27272A" strokeWidth="1" />

      {/* Tiny Medical Cross Mark on Forehead */}
      <path d="M24 10.7V13.3M22.7 12H25.3" stroke="#34D399" strokeWidth="1.4" strokeLinecap="round" />

      {/* Friendly Blinking Eyes */}
      <g className={animate ? 'nano-eye' : ''}>
        <ellipse cx="18.2" cy="22.5" rx="2.4" ry="2.9" fill="#34D399" />
        <ellipse cx="29.8" cy="22.5" rx="2.4" ry="2.9" fill="#34D399" />
        {/* Soft Eye Highlights */}
        <circle cx="19" cy="21.4" r="0.85" fill="#FFFFFF" />
        <circle cx="30.6" cy="21.4" r="0.85" fill="#FFFFFF" />
      </g>

      {/* Subtle Rosy/Emerald Cheek Accents */}
      <ellipse cx="14.8" cy="26.5" rx="1.7" ry="0.9" fill="#10B981" fillOpacity="0.35" />
      <ellipse cx="33.2" cy="26.5" rx="1.7" ry="0.9" fill="#10B981" fillOpacity="0.35" />

      {/* Friendly Small Smile */}
      {mood === 'helpful' ? (
        <path
          d="M19.8 27.6C20.9 29.5 22.4 30.1 24 30.1C25.6 30.1 27.1 29.5 28.2 27.6"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M20.2 27.8C21.3 29.3 22.6 29.8 24 29.8C25.4 29.8 26.7 29.3 27.8 27.8"
          stroke="#FFFFFF"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
