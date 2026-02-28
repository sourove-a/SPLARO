'use client';

import Image from 'next/image';
import type { FC, MouseEventHandler } from 'react';

const BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA0MCAzMCc+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSdnJyB4MT0nMCcgeTE9JzAnIHgyPScxJyB5Mj0nMSc+PHN0b3Agc3RvcC1jb2xvcj0nIzBhMTIyMCcvPjxzdG9wIG9mZnNldD0nMScgc3RvcC1jb2xvcj0nIzExMjUzZScvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSc0MCcgaGVpZ2h0PSczMCcgZmlsbD0ndXJsKCNnKScvPjwvc3ZnPg==';
const EMPTY_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

type OptimizedImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
  quality?: number;
  draggable?: boolean;
  onClick?: MouseEventHandler<HTMLImageElement>;
};

export const OptimizedImage: FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  sizes = '100vw',
  priority = false,
  fill = false,
  width = 1200,
  height = 900,
  quality = 82,
  draggable = false,
  onClick,
}) => {
  const normalizedSrc = typeof src === 'string' && src.trim() ? src.trim() : EMPTY_PIXEL;
  const isDataImage = normalizedSrc.startsWith('data:');

  if (fill) {
    return (
      <Image
        src={normalizedSrc}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        priority={priority}
        quality={quality}
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        draggable={draggable}
        onClick={onClick}
        unoptimized={isDataImage}
      />
    );
  }

  return (
    <Image
      src={normalizedSrc}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      priority={priority}
      quality={quality}
      placeholder="blur"
      blurDataURL={BLUR_DATA_URL}
      draggable={draggable}
      onClick={onClick}
      unoptimized={isDataImage}
    />
  );
};

export default OptimizedImage;
