import https from 'https';

https.get('https://luffa.im/SuperBox/assets/docs_en_jssdk_webview.md.d7Uilqcn.lean.js', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
});
