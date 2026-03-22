import https from 'https';
import fs from 'fs';

https.get('https://uk.luffa.im/docs/quickStartGuide/quickStartGuide.html', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    fs.writeFileSync('luffa_docs.html', data);
    console.log('Saved to luffa_docs.html');
  });
});
