/** File name of a screenshot taken at `at`, in local time so it sorts and reads as the player's clock. */
export function screenshotName(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `calindra-strike-${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}_${pad(at.getHours())}-${pad(at.getMinutes())}-${pad(at.getSeconds())}.png`;
}

/** Downloads the canvas as a PNG. Must run in the same frame as the render that filled it. */
export function saveScreenshot(canvas: HTMLCanvasElement, at: Date): void {
  const link = document.createElement('a');
  link.download = screenshotName(at);
  link.href = canvas.toDataURL('image/png');
  link.click();
}
