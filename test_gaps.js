// Test touching bridge in horizontal gap
const H = 52;
const colProj = new Int32Array(300);
// Badge 1 from x=10 to x=120
for (let x = 10; x <= 120; x++) colProj[x] = 48;
// Badge 2 from x=130 to x=240
for (let x = 130; x <= 240; x++) colProj[x] = 48;
// Gap is 121 to 129 (9px gap)
// Add 2-pixel touching bridge at x=125
colProj[125] = 2;

const maxCol = Math.max(...colProj);
const thresh = Math.max(1, Math.round(maxCol * 0.08)); // 48 * 0.08 = 4

let inBand = false;
let startX = 0;
const bands = [];
for (let x = 0; x < 300; x++) {
  if (colProj[x] > thresh) {
    if (!inBand) {
      inBand = true;
      startX = x;
    }
  } else {
    if (inBand) {
      bands.push({ startX, endX: x - 1 });
      inBand = false;
    }
  }
}
if (inBand) bands.push({ startX, endX: 299 });

console.log("Detected bands count:", bands.length);
console.log("Bands:", bands);
