import React from 'react'
import { Button as MuiButton } from '@mui/material'
import type { ButtonProps as MuiButtonProps } from '@mui/material/Button'
import { tokens } from '../theme/tokens'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'small' | 'medium' | 'large'

interface CustomButtonProps extends Omit<MuiButtonProps, 'variant' | 'size'> {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: React.ReactNode
}

const variantStyles = {
  primary: {
    backgroundColor: tokens.color.brand.primary,
    color: '#ffffff',
    boxShadow: '0 1px 2px rgba(13,148,136,0.20)',
    '&:hover': {
      backgroundColor: tokens.color.brand.hover,
      boxShadow: '0 3px 8px rgba(13,148,136,0.30)',
    },
    '&:active': { backgroundColor: '#115e59', boxShadow: 'none' },
    '&:disabled': { backgroundColor: tokens.color.brand.subtle, color: tokens.color.brand.hover, boxShadow: 'none' },
  },
  secondary: {
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '1.5px solid #e5e7eb',
    boxShadow: 'none',
    '&:hover': { backgroundColor: '#f9fafb', borderColor: '#d1d5db', boxShadow: 'none' },
    '&:active': { backgroundColor: '#f3f4f6' },
    '&:disabled': { backgroundColor: '#f9fafb', color: '#9ca3af', borderColor: '#e5e7eb' },
  },
  danger: {
    backgroundColor: '#dc2626',
    color: '#ffffff',
    boxShadow: '0 1px 2px rgba(220,38,38,0.15)',
    '&:hover': { backgroundColor: '#b91c1c', boxShadow: '0 3px 8px rgba(220,38,38,0.25)' },
    '&:active': { backgroundColor: '#991b1b', boxShadow: 'none' },
    '&:disabled': { backgroundColor: '#fecaca', color: '#7f1d1d', boxShadow: 'none' },
  },
  ghost: {
    backgroundColor: 'transparent',
    color: '#374151',
    boxShadow: 'none',
    '&:hover': { backgroundColor: '#f3f4f6', boxShadow: 'none' },
    '&:active': { backgroundColor: '#e5e7eb' },
    '&:disabled': { color: '#9ca3af' },
  },
}

const sizeStyles = {
  small: {
    fontSize: '13px',
    padding: '6px 14px',
    height: '34px',
    letterSpacing: '0.01em',
  },
  medium: {
    fontSize: '14px',
    padding: '9px 18px',
    height: '40px',
    letterSpacing: '0.01em',
  },
  large: {
    fontSize: '15px',
    padding: '11px 22px',
    height: '46px',
    letterSpacing: '0.01em',
  },
}

export default function CustomButton({
  variant = 'primary',
  size = 'medium',
  children,
  ...props
}: CustomButtonProps) {
  return (
    <MuiButton
      {...props}
      sx={{
        ...variantStyles[variant],
        ...sizeStyles[size],
        borderRadius: '8px',
        textTransform: 'none',
        fontWeight: 600,
        lineHeight: 1,
        transition: 'background-color 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        ...props.sx,
      }}
    >
      {children}
    </MuiButton>
  )
}
