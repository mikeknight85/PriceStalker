import React, { useState, useEffect } from 'react';

interface ImagePreviewProps {
  src: string | null | undefined;
  /** Rendered size. The candidate table uses a thumbnail, the header a frame. */
  size?: number;
  /** Shown when there is no URL at all, as opposed to one that failed. */
  emptyLabel?: string;
}

/**
 * An image that says when it could not load, instead of showing a broken icon
 * (issue #180).
 *
 * The debug page lists every candidate the extractor considered, including ones
 * it rejected -- that is the point of the page. But rendering them as plain
 * <img> meant a directory URL from JSON-LD drew the browser's broken-image
 * glyph, which reads as the page malfunctioning rather than as the candidate
 * being bad.
 *
 * Distinguishing "did not load" from "nothing here" matters on this page
 * specifically: someone is looking at it to work out *why* a retailer is
 * misbehaving, and "this candidate resolves to nothing" is the answer they came
 * for rather than a rendering artefact.
 */
const ImagePreview: React.FC<ImagePreviewProps> = ({ src, size, emptyLabel = 'No Image' }) => {
  const [failed, setFailed] = useState(false);

  // A new URL deserves a fresh attempt; without this a candidate that failed
  // once stays marked failed when the panel is reused for another scrape.
  useEffect(() => setFailed(false), [src]);

  const boxStyle: React.CSSProperties = size
    ? { width: size, height: size, objectFit: 'contain', flex: '0 0 auto' }
    : {};

  if (!src) {
    return <div className="image-placeholder" style={boxStyle}>{emptyLabel}</div>;
  }

  if (failed) {
    return (
      <div
        className="image-placeholder image-placeholder-failed"
        style={boxStyle}
        title={`This URL did not load as an image:\n${src}`}
      >
        {size ? '!' : 'Did not load'}
      </div>
    );
  }

  return <img src={src} alt="" style={boxStyle} onError={() => setFailed(true)} />;
};

export default ImagePreview;
