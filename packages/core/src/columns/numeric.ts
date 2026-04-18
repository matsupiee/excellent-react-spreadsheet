export const isBlank = (raw: string): boolean => raw.trim() === '';

export const clamp = (value: number, min: number | undefined, max: number | undefined): number => {
  let next = value;
  if (min !== undefined && next < min) next = min;
  if (max !== undefined && next > max) next = max;
  return next;
};
