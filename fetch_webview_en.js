import https from 'https';

https.get('https://luffa.im/SuperBox/docs/en/jssdk/webview.html', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
});
