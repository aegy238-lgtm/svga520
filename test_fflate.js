const { Zip, ZipPassThrough } = require('fflate');
const zip = new Zip();
zip.ondata = (err, chunk, final) => {
  console.log("Chunk:", chunk.length, "Final:", final);
}
const file = new ZipPassThrough("test.txt");
zip.add(file);
file.push(new Uint8Array([1,2,3]), true);
zip.end();
