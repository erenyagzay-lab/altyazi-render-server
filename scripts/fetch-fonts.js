// Bu script SADECE Docker imajı derlenirken (build time) bir kez
// çalışır. Yani bir font indirilemezse, uygulama ÇALIŞIRKEN sessizce
// bozulmak yerine, DEPLOY SIRASINDA hemen görünür bir hata verir —
// Android'de yaşadığımız "sessiz başarısızlık" sorununun tam tersi.
const https = require('https');
const fs = require('fs');
const path = require('path');

const FONT_DIR = '/usr/share/fonts/truetype/custom';
fs.mkdirSync(FONT_DIR, { recursive: true });

const FONTS = {
  Montserrat: 'Montserrat',
  Poppins: 'Poppins',
  'Bebas Neue': 'BebasNeue',
  Anton: 'Anton',
  Oswald: 'Oswald',
  Nunito: 'Nunito',
  'Archivo Black': 'ArchivoBlack',
  'Baloo 2': 'Baloo2',
  Lato: 'Lato',
  'DM Sans': 'DMSans',
  'Playfair Display': 'PlayfairDisplay',
  Caveat: 'Caveat',
  'Roboto Condensed': 'RobotoCondensed',
};

const UA = 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)';

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location, headers).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} - ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

async function fetchWeight(family, slug, weight) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family
  )}:wght@${weight}&display=swap`;
  const cssBuf = await get(cssUrl, { 'User-Agent': UA });
  const css = cssBuf.toString('utf8');
  const match = css.match(/url\((https:\/\/[^)]+)\)/);
  if (!match) throw new Error(`Dosya adresi bulunamadı: ${family} ${weight}`);

  const fontBuf = await get(match[1], { 'User-Agent': UA });
  const outPath = path.join(FONT_DIR, `${slug}-${weight}.ttf`);
  fs.writeFileSync(outPath, fontBuf);
  console.log(`✅ ${family} ${weight} indirildi (${fontBuf.length} byte)`);
}

async function main() {
  let successCount = 0;
  let totalAttempts = 0;

  for (const [family, slug] of Object.entries(FONTS)) {
    for (const weight of [400, 900]) {
      totalAttempts++;
      try {
        await fetchWeight(family, slug, weight);
        successCount++;
      } catch (err) {
        // Bazı fontlar (Anton, Archivo Black, Bebas Neue gibi) tek
        // ağırlık destekler — 900 isteği o yüzden başarısız olabilir,
        // bu normal. Sadece logluyoruz, durdurmuyoruz.
        console.warn(`⚠️  ${family} ${weight} atlandı: ${err.message}`);
      }
    }
  }

  console.log(`Font indirme tamamlandı: ${successCount}/${totalAttempts} dosya.`);

  // En az BİR dosya bile inmediyse, bu ciddi bir sorun demektir —
  // build'i burada durdurup net bir hata verelim.
  if (successCount === 0) {
    console.error('HİÇBİR FONT İNDİRİLEMEDİ — build durduruluyor.');
    process.exit(1);
  }
}

main();
