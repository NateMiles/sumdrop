// Renders public/icon.svg to the PNG icons the home-screen web app uses. Run: node scripts/icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../public/icon.svg'), 'utf8');
  const b = await chromium.launch();
  for (const size of [180, 192, 512]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>html,body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
    const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
    await p.screenshot({ path: path.join(__dirname, '../public', name) });
  }
  await b.close();
})();
