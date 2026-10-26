/** iOS browsers share WebKit. The full Next 16/Tailwind 4 UI needs iOS 16.4+. */
export function needsLiteVersion(userAgent: string): boolean {
  const ios = /(?:iPhone|iPad|iPod).*?OS (\d+)[_.](\d+)/i.exec(userAgent);
  if (ios)
    return Number(ios[1]) < 16 || (Number(ios[1]) === 16 && Number(ios[2]) < 4);
  return false;
}
