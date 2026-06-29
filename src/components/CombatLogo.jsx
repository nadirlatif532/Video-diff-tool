export default function CombatLogo({ size = 32 }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: size, height: size }}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 32 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'drop-shadow(0 0 8px rgba(177, 78, 89, 0.5))' }}
      >
        {/* Glowing Crest Shield with Wine Plum & Shadow Grey Gradient */}
        <path 
          d="M16 29C16 29 27 23.5 27 12V6L16 2L5 6V12C5 23.5 16 29 16 29Z" 
          fill="url(#shield_grad_plum)" 
          stroke="var(--primary)" 
          strokeWidth="2" 
          strokeLinejoin="round"
        />
        {/* Crossed Swords - Silver & Sandy Clay Hilts */}
        <path d="M10 22L22 10" stroke="#f2f0f4" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M9 23L11 21" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M21 9L23 11" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        
        <path d="M22 22L10 10" stroke="#f2f0f4" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M23 23L21 21" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M11 9L9 11" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />

        {/* Center Core Emblem - Sandy Clay Accent */}
        <polygon points="16,12 19,16 16,20 13,16" fill="var(--accent)" stroke="#ffffff" strokeWidth="1.5" />

        <defs>
          <linearGradient id="shield_grad_plum" x1="16" y1="2" x2="16" y2="29" gradientUnits="userSpaceOnUse">
            <stop stopColor="#322b3b" stopOpacity="0.95" />
            <stop offset="1" stopColor="#19161d" stopOpacity="0.98" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
