import React, { useState } from 'react'

type Props = {
  src?: string | null
  alt?: string
  className?: string
  fallbackSrc?: string
  /** Default: lazy. Use "eager" for above-the-fold / LCP images. */
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'auto' | 'sync'
  width?: number | string
  height?: number | string
  srcSet?: string
  sizes?: string
}

export default function ImageWithFallback({
  src,
  alt,
  className,
  fallbackSrc,
  loading = 'lazy',
  decoding = 'async',
  width,
  height,
  srcSet,
  sizes,
}: Props) {
  const [cur, setCur] = useState<string | undefined | null>(src || undefined)
  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img
      src={cur || fallbackSrc}
      alt={alt || ''}
      className={className}
      loading={loading}
      decoding={decoding}
      width={width}
      height={height}
      srcSet={srcSet}
      sizes={sizes}
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
