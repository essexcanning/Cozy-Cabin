import https from 'https';
import fs from 'fs';

https.get('https://tencentcloud.github.io/tcmpp-demo-miniprogram/jssdk/tcmpp-jssdk-1.0.0.js', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('tcmpp-jssdk.js', data);
    console.log('Saved to tcmpp-jssdk.js');
  });
});
