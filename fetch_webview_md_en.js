import https from 'https';
import fs from 'fs';

https.get('https://luffa.im/SuperBox/assets/docs_en_jssdk_webview.md.NG7DUTCs.lean.js', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('webview_md_en.js', data);
    console.log('Saved to webview_md_en.js');
  });
});
