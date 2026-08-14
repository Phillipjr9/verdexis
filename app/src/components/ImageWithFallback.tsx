import React, { useState } from 'react'

export default function ImageWithFallback({ src, alt, className, fallbackSrc }: { src?: string | null; alt?: string; className?: string; fallbackSrc?: string }) {
  const [cur, setCur] = useState<string | undefined | null>(src || undefined)
  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img
      src={cur || fallbackSrc}
      alt={alt || ''}
      className={className}
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement
        if (fallbackSrc && img.src !== fallbackSrc) {
          img.src = fallbackSrc
          return
        }
        // hide broken image gracefully
        img.style.display = 'none'
      }}
    />
  )
}
