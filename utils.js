
const box_intersect = (a, b) => !(
    ((a.y + a.h) < (b.y)) ||
    (a.y > (b.y + b.h)) ||
    ((a.x + a.w) < b.x) ||
    (a.x > (b.x + b.w))
);

const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

// ref: https://www.trysmudford.com/blog/linear-interpolation-functions/

/**
 * get value between a and b at % t
 * 
 * @param {number} a 
 * @param {number} b 
 * @param {number} t 
 * @returns {number}
 */
const lerp = (a, b, t) => a * (1 - t) + (b * t);

// 
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// get % for value between a and b
const invlerp = (a, b, v) => clamp((v - a) / (b - a));

// transform value between data ranges
const range = (x1, y1, x2, y2, value) => lerp(x2, y2, invlerp(x1, y1, value));
