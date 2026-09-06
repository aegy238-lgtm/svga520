const width = 200;
const height = 100;
const mask = new Uint8Array(width * height);

// Draw Badge A: (10, 10) to (90, 40)
for (let y = 10; y <= 40; y++) {
  for (let x = 10; x <= 90; x++) mask[y * width + x] = 1;
}

// Draw Badge B: (10, 50) to (90, 80)
for (let y = 50; y <= 80; y++) {
  for (let x = 10; x <= 90; x++) mask[y * width + x] = 1;
}

// Diagonal touch between (50, 40) and (51, 41) - wait!
// Between Badge A (bottom y=40) and Badge B (top y=50), there's a 9px gap.
// Suppose they touch corner-to-corner at (50, 40) and (51, 41):
mask[41 * width + 51] = 1;
// ... if someone connects diagonally to (59, 49) and (60, 50)

// 4-way BFS:
const visited4 = new Uint8Array(width * height);
let count4 = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = y * width + x;
    if (mask[idx] === 1 && !visited4[idx]) {
      count4++;
      // BFS
      const q = [idx];
      visited4[idx] = 1;
      let h = 0;
      while (h < q.length) {
        const curr = q[h++];
        const cx = curr % width;
        const cy = (curr / width) | 0;
        const n4 = [curr - 1, curr + 1, curr - width, curr + width];
        for (const n of n4) {
          if (n >= 0 && n < mask.length && mask[n] === 1 && !visited4[n]) {
            const nx = n % width;
            if (Math.abs(nx - cx) <= 1) {
              visited4[n] = 1;
              q.push(n);
            }
          }
        }
      }
    }
  }
}

console.log("4-way BFS components count (excluding stray 1-px if filtered):", count4);
