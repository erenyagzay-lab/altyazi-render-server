const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const { generateAss } = require('./caption_ass_generator');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: os.tmpdir() });

app.get('/', (req, res) => {
  res.send('Altyazı render sunucusu ayakta ✅');
});

/**
 * Video + altyazı verisini (kelimeler, stil, kelime bazlı override'lar)
 * alır, bir .ass altyazı dosyası üretir, tek bir hızlı ffmpeg komutuyla
 * videoya yakar ve sonucu geri döner. İşlem bitince tüm geçici
 * dosyalar silinir, sunucuda hiçbir şey kalmaz.
 */
app.post('/render', upload.fields([{ name: 'video', maxCount: 1 }]), async (req, res) => {
  if (!req.files || !req.files.video) {
    return res.status(400).json({ error: 'Video dosyası gönderilmedi.' });
  }
  if (!req.body.captions) {
    return res.status(400).json({ error: 'Altyazı verisi (captions) gönderilmedi.' });
  }

  const jobId = Date.now().toString();
  const inputPath = req.files.video[0].path;
  const assPath = `${inputPath}-captions-${jobId}.ass`;
  const outputPath = `${inputPath}-out-${jobId}.mp4`;

  try {
    const { words, style, overrides } = JSON.parse(req.body.captions);

    // ffprobe ile videonun gerçek boyutunu al (istemciden gelen değere
    // körü körüne güvenmek yerine).
    const probeJson = await runCommand(
      `ffprobe -v quiet -print_format json -show_streams "${inputPath}"`
    );
    const probe = JSON.parse(probeJson);
    const videoStream = probe.streams.find((s) => s.codec_type === 'video');
    const width = videoStream.width;
    const height = videoStream.height;

    const assContent = generateAss({
      words,
      style,
      overrides: overrides || {},
      videoWidth: width,
      videoHeight: height,
    });
    fs.writeFileSync(assPath, assContent);

    const command =
      `ffmpeg -y -i "${inputPath}" -vf "ass=${assPath}" ` +
      `-c:a copy -c:v libx264 -crf 18 -preset veryfast -pix_fmt yuv420p "${outputPath}"`;

    console.log('FFMPEG KOMUTU:', command);
    await runCommand(command);

    res.download(outputPath, 'altyazili_video.mp4', () => {
      cleanup([inputPath, assPath, outputPath]);
    });
  } catch (err) {
    console.error('Render hatası:', err);
    cleanup([inputPath, assPath, outputPath]);
    res.status(500).json({ error: 'Render başarısız', detail: String(err) });
  }
});

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr);
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

function cleanup(paths) {
  for (const p of paths) {
    fs.unlink(p, () => {});
  }
}

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
