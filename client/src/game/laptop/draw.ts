export function drawLaptop(ctx: CanvasRenderingContext2D, width: number, height: number, scenario: number, progress: number, timeMs: number): void {
  void timeMs;
  ctx.fillStyle = '#10151c';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#e8edf2';
  ctx.font = '24px sans-serif';
  ctx.fillText('laptop ' + scenario + ' · ' + Math.round(progress * 100) + '%', 24, 48);
}

export function drawLaptopScreen(ctx: CanvasRenderingContext2D, width: number, height: number, scenario: number, progress: number, timeMs: number): void {
  drawLaptop(ctx, width, height, scenario, progress, timeMs);
}

export function drawIdleScreen(ctx: CanvasRenderingContext2D, width: number, height: number, scenario: number, secondsLeft: number, timeMs: number): void {
  void timeMs;
  ctx.fillStyle = '#10151c';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#e8edf2';
  ctx.font = '24px sans-serif';
  ctx.fillText('laptop ' + scenario + ' · ' + Math.ceil(secondsLeft) + 's', 24, 48);
}
