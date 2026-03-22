const https = require('https');
https.get('https://uk.luffa.im/docs/quickStartGuide/quickStartGuide.html', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log(data.substring(0, 1000)); });
});
