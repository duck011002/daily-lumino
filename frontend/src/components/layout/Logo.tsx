import React from 'react'

interface LogoProps {
  size?: number
  showText?: boolean
  textSize?: string
  className?: string
  textClassName?: string
}

export default function Logo({
  size = 28,
  showText = true,
  textSize = 'text-2xl',
  className = '',
  textClassName = '',
}: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* SVG Icon */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: size, height: size }}
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(232, 129, 74)" />
            <stop offset="100%" stopColor="#FFB38A" />
          </linearGradient>
        </defs>
        {/* Sanctuary Shield / Beacon teardrop curve */}
        <path
          d="M12 22C16.9706 22 21 17.9706 21 13C21 7.5 12 2 12 2C12 2 3 7.5 3 13C3 17.9706 7.02944 22 12 22Z"
          stroke="url(#logo-grad)"
          strokeWidth="2.2"
          strokeLinejoin="round"
          className="drop-shadow-[0_2px_8px_rgba(232,129,74,0.2)]"
        />
        {/* Inner glowing beacon star */}
        <path
          d="M12 7.5L13.4 10.6L16.5 12L13.4 13.4L12 16.5L10.6 13.4L7.5 12L10.6 10.6L12 7.5Z"
          fill="url(#logo-grad)"
        />
      </svg>

      {/* Styled Text */}
      {showText && (
        <span
          className={`font-display font-bold tracking-wide bg-gradient-to-r from-primary to-[#FF9E66] bg-clip-text text-transparent ${textSize} ${textClassName}`}
        >
          Lumino
        </span>
      )}
    </div>
  )
}
