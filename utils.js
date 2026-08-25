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

// High-performance Canvas CSS Color String Cache (Eliminates GC string allocations & CSS parser churn)
const _hslCache = new Map();
const getHsl = (h, s, l) => {
    const ih = ((Math.round(h) % 360) + 360) % 360;
    const is = clamp(Math.round(s), 0, 100);
    const il = clamp(Math.round(l), 0, 100);
    const key = (ih << 16) | (is << 8) | il;
    let str = _hslCache.get(key);
    if (!str) {
        str = `hsl(${ih},${is}%,${il}%)`;
        if (_hslCache.size > 2500) _hslCache.clear();
        _hslCache.set(key, str);
    }
    return str;
};

const getHsla = (h, s, l, a) => {
    const ih = ((Math.round(h) % 360) + 360) % 360;
    const is = clamp(Math.round(s), 0, 100);
    const il = clamp(Math.round(l), 0, 100);
    const ia = clamp(Math.round(a * 100), 0, 100);
    const key = (ih << 20) | (is << 14) | (il << 7) | ia;
    let str = _hslCache.get(key);
    if (!str) {
        str = `hsla(${ih},${is}%,${il}%,${ia / 100})`;
        if (_hslCache.size > 3500) _hslCache.clear();
        _hslCache.set(key, str);
    }
    return str;
};

const _rgbaCache = new Map();
const getRgba = (r, g, b, a) => {
    const ir = clamp(Math.round(r), 0, 255);
    const ig = clamp(Math.round(g), 0, 255);
    const ib = clamp(Math.round(b), 0, 255);
    const ia = clamp(Math.round(a * 100), 0, 100);
    const key = (ir << 24) | (ig << 16) | (ib << 8) | ia;
    let str = _rgbaCache.get(key);
    if (!str) {
        str = `rgba(${ir},${ig},${ib},${ia / 100})`;
        if (_rgbaCache.size > 1500) _rgbaCache.clear();
        _rgbaCache.set(key, str);
    }
    return str;
};
