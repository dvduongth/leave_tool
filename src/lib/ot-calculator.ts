export function calculateOTMinutes(otStart: string, otEnd: string): number {
  const startParts = otStart.split(":");
  const endParts = otEnd.split(":");

  const startMinutes = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
  const endMinutes = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);

  // Handle overnight: if end is before start, add 24 hours
  if (endMinutes <= startMinutes) {
    return 24 * 60 - startMinutes + endMinutes;
  }

  return endMinutes - startMinutes;
}
