
export const box_intersect = (a, b) => !(
    ((a.y + a.h) < (b.y)) ||
    (a.y > (b.y + b.h)) ||
    ((a.x + a.w) < b.x) ||
    (a.x > (b.x + b.w))
);

export const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);


