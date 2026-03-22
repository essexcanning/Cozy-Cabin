import https from 'https';
import fs from 'fs';

https.get('https://luffa.im/SuperBox/docs/en/jssdk/webview.html', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('webview_docs.html', data);
    console.log('Saved to webview_docs.html');
  });
});
