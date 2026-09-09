import React, { useState, useEffect } from "react";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  fallbackSrcs?: string[];
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  fallbackSrc,
  fallbackSrcs = [],
  alt,
  className = "",
  ...props
}) => {
  const [candidateIndex, setCandidateIndex] = useState<number>(0);
  const [hasFailedAll, setHasFailedAll] = useState<boolean>(false);

  // Build clean list of candidate URLs from dofusdb only
  const candidates = Array.from(
    new Set(
      [
        src,
        fallbackSrc,
        ...fallbackSrcs,
      ].filter((url): url is string => Boolean(url && typeof url === "string" && !url.includes("dofusdu")))
    )
  );

  useEffect(() => {
    setCandidateIndex(0);
    setHasFailedAll(false);
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex((prev) => prev + 1);
    } else {
      setHasFailedAll(true);
    }
  };

  const activeSrc = candidates[candidateIndex];

  if (hasFailedAll || !activeSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-900 border border-slate-800 text-amber-400 font-bold text-xs rounded-xl select-none ${className}`}
        title={alt || "Ítem"}
      >
        <span>{(alt || "•").charAt(0).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt || "icono"}
      className={className}
      onError={handleError}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      {...props}
    />
  );
};
