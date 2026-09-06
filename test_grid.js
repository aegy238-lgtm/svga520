// Test row & column band detection
function findBands(proj, length, minSize, minGap) {
  const bands = [];
  let inBand = false;
  let bandStart = 0;
  
  // Find baseline noise threshold (e.g. 2% of max or foreground)
  const maxVal = Math.max(...proj);
  const threshold = Math.max(1, maxVal * 0.05);

  for (let i = 0; i < length; i++) {
    const val = proj[i];
    if (val > threshold) {
      if (!inBand) {
        inBand = true;
        bandStart = i;
      }
    } else {
      if (inBand) {
        if (i - bandStart >= minSize) {
          bands.push({ start: bandStart, end: i - 1 });
        }
        inBand = false;
      }
    }
  }
  if (inBand && length - bandStart >= minSize) {
    bands.push({ start: bandStart, end: length - 1 });
  }
  return bands;
}

console.log("Script syntax check OK");
