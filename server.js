const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: os.tmpdir() });

app.get('/', (req, res) => {
  res.send('Altyazı render sunucusu ayakta ✅');
});

/**
 * Test amaçlı: bir video dosyası alır, ffmpeg ile "yeniden paketler"
 * (henüz altyazı eklemiyor — sadece boru hattının uçtan uca çalıştığını
 * kanıtlamak için) ve sonucu geri döner. İşlem bitince geçici dosyaları
 * siler, hiçbir şey sunucuda kalmaz.
 */
app.post('/render-test', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Video dosyası gönderilmedi.' });
  }

  const inputPath = req.file.path;
  const outputPath = `${inputPath}-out.mp4`;

  // -c copy: videoyu yeniden kodlamadan sadece kabını değiştiriyor,
  // bu yüzden çok hızlı — amacımız sadece ffmpeg'in çalıştığını görmek.
  const command = `ffmpeg -y -i "${inputPath}" -c copy "${outputPath}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('ffmpeg hatası:', stderr);
      cleanup([inputPath, outputPath]);
      return res.status(500).json({ error: 'ffmpeg işlemi başarısız', detail: stderr });
    }

    res.download(outputPath, 'islenmis_video.mp4', (err) => {
      if (err) console.error('Gönderim hatası:', err);
      cleanup([inputPath, outputPath]);
    });
  });
});

function cleanup(paths) {
  for (const p of paths) {
    fs.unlink(p, () => {});
  }
}

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
