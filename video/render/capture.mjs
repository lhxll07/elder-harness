// Frame capture: one page evaluate per frame.
//
// The page exposes window.__renderAt(t) which draws the film at that instant
// and returns the canvas contents. Nothing in the page reads Date.now() or
// requestAnimationFrame, so frame N is byte-identical no matter which worker
// renders it or how many frames were rendered before.

export function captureExpr(t, format, quality) {
  const type = format === 'png' ? 'image/png' : 'image/jpeg'
  const q = format === 'png' ? '' : `, ${quality / 100}`
  return `
    (() => {
      const source = document.getElementById('view');
      const gl = window.__stage.renderer.getContext();
      let capture = window.__frameCapture;
      if (!capture || capture.width !== source.width || capture.height !== source.height) {
        const canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
        capture = window.__frameCapture = {
          canvas, context, width: source.width, height: source.height,
          pixels: new Uint8Array(source.width * source.height * 4),
          image: context.createImageData(source.width, source.height),
        };
      }
      window.__captureFrameRetries = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        window.__renderAt(${t.toFixed(6)});
        gl.finish();
        if (window.__stage.captureTarget) {
          window.__stage.renderer.readRenderTargetPixels(window.__stage.captureTarget, 0, 0, capture.width, capture.height, capture.pixels);
        } else {
          gl.readPixels(0, 0, capture.width, capture.height, gl.RGBA, gl.UNSIGNED_BYTE, capture.pixels);
        }
        const expectedScene = window.__expectedSceneVisible === true || window.__fusionDetail?.compile?.root.visible === true;
        let energy = 0;
        if (expectedScene) {
          for (let row = 0; row < 8; row++) {
            for (let column = 0; column < 12; column++) {
              const horizontal = Math.floor(capture.width * (0.2 + column * 0.6 / 11));
              const vertical = Math.floor(capture.height * (0.25 + row * 0.5 / 7));
              const pixel = (vertical * capture.width + horizontal) * 4;
              energy += capture.pixels[pixel] + capture.pixels[pixel + 1] + capture.pixels[pixel + 2];
            }
          }
        }
        if (!expectedScene || energy / (8 * 12 * 3) > 2) break;
        window.__captureFrameRetries++;
        if (attempt === 2) throw new Error('Expected compiler scene is blank after three complete renders');
      }
      const stride = capture.width * 4;
      for (let row = 0; row < capture.height; row++) {
        const offset = (capture.height - row - 1) * stride;
        capture.image.data.set(capture.pixels.subarray(offset, offset + stride), row * stride);
      }
      capture.context.putImageData(capture.image, 0, 0);
      return capture.canvas.toDataURL('${type}'${q});
    })()
  `
}

export function extFor(format) {
  return format === 'png' ? 'png' : 'jpg'
}

export function decodeDataURL(dataURL) {
  const comma = dataURL.indexOf(',')
  if (comma < 0) throw new Error('not a data URL: ' + dataURL.slice(0, 80))
  return Buffer.from(dataURL.slice(comma + 1), 'base64')
}
