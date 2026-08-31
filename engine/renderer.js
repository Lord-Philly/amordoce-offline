export function drawImageOnCanvas(ctx, canvas, src, drawFn) {
  const img = new Image();
  img.onload = () => {
    drawFn(ctx, canvas, img);
  };
  img.src = src;
  return img;
}

export function clearCanvas(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawScaled(ctx, canvas, img, scaleX, offsetX) {
  canvas.width = canvas.width;
  clearCanvas(ctx, canvas);
  const w = img.width * scaleX;
  const h = img.height * scaleX;
  ctx.drawImage(img, (canvas.width - w) / 2 + offsetX, 0, w, h);
}
