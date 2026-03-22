import https from 'https';

https.get('https://tencentcloud.github.io/tcmpp-demo-miniprogram/jssdk/tcmpp-jssdk-1.0.0.js', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
});
