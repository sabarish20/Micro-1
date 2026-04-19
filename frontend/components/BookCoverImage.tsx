"use client";

import { useState, type ReactNode } from "react";

type Props = {
  imageUrl: string | null | undefined;
  alt: string;
  imgClassName: string;
  fallback: ReactNode;
};

/** Product cover with lazy loading and fallback on load error (404, blocked URL, etc.). */
export default function BookCoverImage({ imageUrl, alt, imgClassName, fallback }: Props) {
  const [failed, setFailed] = useState(false);
  if (!imageUrl || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={alt}
      className={imgClassName}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
