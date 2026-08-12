import React, { useState } from "react";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  fallbackSrc,
  alt,
  ...props
}) => {
  const [imgSrc, setImgSrc] = useState(src);

  return (
    <img
      {...props}
      src={imgSrc}
      alt={alt || "icono"}
      onError={() => {
        if (imgSrc !== fallbackSrc) {
          setImgSrc(
            fallbackSrc || "https://placehold.co/64x64/111111/f59e0b?text=%3F",
          );
        }
      }}
    />
  );
};
