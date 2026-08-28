export type ClassValue =
  | ClassValue[]
  | string
  | number
  | null
  | boolean
  | undefined
  | { [key: string]: boolean | null | undefined };

function toVal(mix: ClassValue): string {
  let k;
  let y;
  let str = '';

  if (typeof mix === 'string' || typeof mix === 'number') {
    str += mix;
  } else if (typeof mix === 'object') {
    if (Array.isArray(mix)) {
      const len = mix.length;
      for (k = 0; k < len; k += 1) {
        if (mix[k]) {
          y = toVal(mix[k]);
          if (y) {
            if (str) str += ' ';
            str += y;
          }
        }
      }
    } else if (mix) {
      for (const key of Object.keys(mix)) {
        if (mix[key]) {
          if (str) str += ' ';
          str += key;
        }
      }
    }
  }

  return str;
}

export function clsx(...inputs: ClassValue[]): string {
  let i = 0;
  let tmp;
  let x;
  let str = '';
  const len = inputs.length;
  for (; i < len; i += 1) {
    tmp = inputs[i];
    if (tmp) {
      x = toVal(tmp);
      if (x) {
        if (str) str += ' ';
        str += x;
      }
    }
  }
  return str;
}

export function cn(...inputs: ClassValue[]): string {
  return clsx(...inputs);
}
