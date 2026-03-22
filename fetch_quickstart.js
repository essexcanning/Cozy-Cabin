import https from 'https';

https.get('https://uk.luffa.im/docs/quickStartGuide/quickStartGuide.html', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(data);
  });
});
