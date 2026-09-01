const https = require('https');
const fs = require('fs');
https.get('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js', (res) => {
  const file = fs.createWriteStream('public/gif.worker.js');
  res.pipe(file);
});
