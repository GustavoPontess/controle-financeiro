import React from 'react'

interface SidebarIconProps {
  sx?: React.CSSProperties & Record<string, unknown>
}

export default function SidebarToggleIcon({ sx }: SidebarIconProps) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={sx}
    >
      {/* Retângulo externo */}
      <rect x="4" y="4" width="16" height="16" rx="1.5" />

      {/* Linha vertical dividindo sidebar e conteúdo */}
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  )
}
