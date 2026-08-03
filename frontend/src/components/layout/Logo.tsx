import React from 'react'

interface LogoProps {
  size?: number
  showText?: boolean
  textSize?: string
  className?: string
  textClassName?: string
  showTagline?: boolean
}

export default function Logo({
  size = 36,
  showText = true,
  textSize = 'text-xl',
  className = '',
  textClassName = '',
  showTagline = false,
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 48 48"
        role="img"
        aria-label="Lumino"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: size, height: size }}
        className="shrink-0 drop-shadow-[0_7px_18px_rgba(18,60,45,0.18)]"
      >
        <rect width="48" height="48" rx="14" fill="#123C2D" />
        <path
          d="M15 12.5v18.25C15 35.31 18.69 39 23.25 39H35"
          fill="none"
          stroke="#F4B64A"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M33 9.5c.85 4.55 3.45 7.15 8 8-4.55.85-7.15 3.45-8 8-.85-4.55-3.45-7.15-8-8 4.55-.85 7.15-3.45 8-8Z"
          fill="#FFF7E6"
        />
        <circle cx="33" cy="17.5" r="2.25" fill="#F4B64A" />
      </svg>

      {showText && (
        <span className="min-w-0">
          <strong
            className={`block font-display font-bold leading-none tracking-[0.015em] text-[#17211d] dark:text-[#f8f6f0] ${textSize} ${textClassName}`}
          >
            Lumino
          </strong>
          {showTagline && (
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.22em] text-[#17211d]/42 dark:text-foreground/42">
              Digital Garden
            </span>
          )}
        </span>
      )}
    </span>
  )
}
