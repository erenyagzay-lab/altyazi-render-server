const express = require('express');

const app = express();

// Render, sunucunun hangi porttan dinleyeceğini kendisi belirliyor
// (PORT ortam değişkeni ile). Bunu sabit bir sayı yazmak yerine
// oradan okumamız gerekiyor.
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Altyazı render sunucusu ayakta ✅');
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});
