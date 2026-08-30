const https = require('https');
const fs = require('fs');

const files = [
  { url: 'https://cdn.jsdelivr.net/npm/pako@1.0.11/dist/pako.min.js', name: 'pako.min.js' },
  { url: 'https://cdn.jsdelivr.net/npm/svgaplayerweb@2.3.2/build/svga.min.js', name: 'svga.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', name: 'jszip.min.js' },
  { url: 'https://cdn.jsdelivr.net/npm/protobufjs@7.2.4/dist/protobuf.min.js', name: 'protobuf.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js', name: 'gif.js' },
  { url: 'https://cdn.jsdelivr.net/npm/upng-js@2.1.0/UPNG.min.js', name: 'UPNG.min.js' },
  { url: 'https://cdn.jsdelivr.net/npm/webm-muxer@5.0.2/build/webm-muxer.min.js', name: 'webm-muxer.min.js' }
];

files.forEach(file => {
  https.get(file.url, (res) => {
    const stream = fs.createWriteStream(`public/${file.name}`);
    res.pipe(stream);
  });
});
