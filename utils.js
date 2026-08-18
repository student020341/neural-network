// AABB Collision
const box_intersect = (a, b) => (
    a.x <= b.x + b.w &&
    a.x + a.w >= b.x &&
    a.y <= b.y + b.h &&
    a.y + a.h >= b.y
);

// Distance helpers
const distSq = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
};

const dist = (a, b) => Math.sqrt(distSq(a, b));

const uDistVector = (a, b) => ({ x: Math.abs(a.x - b.x), y: Math.abs(a.y - b.y) });
const sDistVector = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

// Interpolation & Range
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const invlerp = (a, b, v) => (b === a ? 0 : clamp((v - a) / (b - a), 0, 1));
const range = (x1, y1, x2, y2, value) => lerp(x2, y2, invlerp(x1, y1, value));

// Randomization helpers
const randRange = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(randRange(min, max + 1));
const randChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ID Generators
let _idCounter = 0;
const nextId = (prefix = "") => (prefix ? `${prefix}_${++_idCounter}` : ++_idCounter);
const uid = (prefix = "", len = 6) => {
    const hash = Math.random().toString(36).substring(2, 2 + len);
    return prefix ? `${prefix}_${hash}` : hash;
};
