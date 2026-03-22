import https from 'https';

https.get('https://uk.luffa.im/docs/quickStartGuide/quickStartGuide.html', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const links = data.match(/href="([^"]+)"/g);
    console.log(links.filter(l => l.toLowerCase().includes('sdk') || l.toLowerCase().includes('web-view') || l.toLowerCase().includes('webview') || l.toLowerCase().includes('api')));
  });
});
