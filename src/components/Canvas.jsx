import { forwardRef } from 'react';

const Canvas = forwardRef(function Canvas(_props, ref) {
  return <canvas ref={ref} className="bio-canvas" />;
});

export default Canvas;
