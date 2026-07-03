// Flutter uygulamasındaki kelime/stil verisini, videoya "yakılabilecek"
// bir .ass altyazı dosyasına çeviren modül. Bu, telefonda (Android'de)
// yaşadığımız font kayıt sorunlarının hiçbirini içermiyor çünkü:
// - Fontlar Docker imajı derlenirken (build time) sisteme kalıcı olarak
//   kuruluyor (fc-cache ile), Android'deki gibi "çalışma zamanında
//   sessizce bulunamama" riski yok.
// - Linux'ta fontconfig'in davranışı çok daha öngörülebilir.
const { registerFont, createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const FONT_DIR = '/usr/share/fonts/truetype/custom';

const FONT_FAMILY_ASS_NAME = {
  montserrat: 'Montserrat',
  poppins: 'Poppins',
  bebasNeue: 'Bebas Neue',
  anton: 'Anton',
  oswald: 'Oswald',
  nunito: 'Nunito',
  archivoBlack: 'Archivo Black',
  baloo2: 'Baloo 2',
  lato: 'Lato',
  dmSans: 'DM Sans',
  playfairDisplay: 'Playfair Display',
  caveat: 'Caveat',
  robotoCondensed: 'Roboto Condensed',
};

const FONT_SLUG = {
  montserrat: 'Montserrat',
  poppins: 'Poppins',
  bebasNeue: 'BebasNeue',
  anton: 'Anton',
  oswald: 'Oswald',
  nunito: 'Nunito',
  archivoBlack: 'ArchivoBlack',
  baloo2: 'Baloo2',
  lato: 'Lato',
  dmSans: 'DMSans',
  playfairDisplay: 'PlayfairDisplay',
  caveat: 'Caveat',
  robotoCondensed: 'RobotoCondensed',
};

// Canvas'ın metin ölçebilmesi için fontları kaydediyoruz (varsa).
for (const [key, slug] of Object.entries(FONT_SLUG)) {
  for (const weight of [400, 900]) {
    const file = path.join(FONT_DIR, `${slug}-${weight}.ttf`);
    if (fs.existsSync(file)) {
      try {
        registerFont(file, { family: FONT_FAMILY_ASS_NAME[key], weight: String(weight) });
      } catch (_) {
        // Kayıt başarısız olsa bile devam et — sadece ölçüm biraz
        // yanlış olur, export çökmez.
      }
    }
  }
}

function fontNameFor(key) {
  return FONT_FAMILY_ASS_NAME[key] || 'Montserrat';
}

/** Flutter Color.value (0xAARRGGBB int) ya da "#RRGGBB" -> ASS &HBBGGRR& */
function toAssColor(value) {
  let r, g, b;
  if (typeof value === 'number') {
    r = (value >> 16) & 0xff;
    g = (value >> 8) & 0xff;
    b = value & 0xff;
  } else {
    const clean = String(value).replace('#', '');
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  }
  const hex = (v) => v.toString(16).padStart(2, '0').toUpperCase();
  return `&H${hex(b)}${hex(g)}${hex(r)}&`;
}

function formatTime(ms) {
  const totalCentis = Math.floor(ms / 10);
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0'
  )}.${String(centis).padStart(2, '0')}`;
}

function buildSegments(words, maxWordsPerSegment = 4, pauseThresholdMs = 600) {
  if (words.length === 0) return [];
  const segments = [];
  let current = [words[0]];
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const word = words[i];
    const gap = word.startMs - prev.endMs;
    if (current.length >= maxWordsPerSegment || gap > pauseThresholdMs) {
      segments.push(current);
      current = [word];
    } else {
      current.push(word);
    }
  }
  segments.push(current);
  return segments;
}

function measureTextWidth(ctx, text, fontKey, fontSize, bold) {
  const family = fontNameFor(fontKey);
  ctx.font = `${bold ? 900 : 500} ${fontSize}px "${family}"`;
  return ctx.measureText(text).width;
}

function generateAss({ words, style, overrides, videoWidth, videoHeight }) {
  const segments = buildSegments(words, 4, 600);
  const measureCanvas = createCanvas(10, 10);
  const ctx = measureCanvas.getContext('2d');

  const lines = [];
  lines.push('[Script Info]');
  lines.push('ScriptType: v4.00+');
  lines.push(`PlayResX: ${videoWidth}`);
  lines.push(`PlayResY: ${videoHeight}`);
  lines.push('ScaledBorderAndShadow: yes');
  lines.push('');
  lines.push('[V4+ Styles]');
  lines.push(
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, ' +
      'BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, ' +
      'BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding'
  );

  const outlineWidth = style.showBackground ? 2 : 0;
  const shadowDepth = style.showBackground ? 0 : 1;
  const marginV = Math.round(videoHeight * 0.175);
  const defaultFontName = fontNameFor(style.font);
  const inactiveColor = style.inactiveTextColor != null ? style.inactiveTextColor : 0xffffffff;

  lines.push(
    `Style: Default,${defaultFontName},${Math.round(style.fontSize)},` +
      `${toAssColor(style.pillColor)},${toAssColor(inactiveColor)},` +
      `&H00000000&,&H00000000&,${style.bold ? -1 : 0},0,0,0,100,100,0,0,` +
      `1,${outlineWidth},${shadowDepth},2,40,40,${marginV},1`
  );
  lines.push('');
  lines.push('[Events]');
  lines.push(
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  );

  for (const segment of segments) {
    const flowWords = [];
    const pinnedWords = [];
    for (const word of segment) {
      const o = overrides[word.id];
      if (o && o.alignX != null && o.alignY != null) {
        pinnedWords.push(word);
      } else {
        flowWords.push(word);
      }
    }

    if (flowWords.length > 0) {
      const start = flowWords[0].startMs;
      const end = flowWords[flowWords.length - 1].endMs;

      const wordSpacing = 8;
      const horizontalPadding = 48;

      let naturalWidth = 0;
      for (const word of flowWords) {
        const displayText = style.uppercase ? word.text.toUpperCase() : word.text;
        naturalWidth += measureTextWidth(
          ctx,
          displayText,
          style.font,
          style.fontSize,
          style.bold
        );
      }
      naturalWidth += wordSpacing * (flowWords.length - 1);

      const availableWidth = videoWidth - horizontalPadding;
      let fitScale = naturalWidth > 0 ? availableWidth / naturalWidth : 1;
      fitScale = Math.max(0.3, Math.min(5.0, fitScale));
      const effectiveFontSize = Math.round(style.fontSize * fitScale);

      let text = `{\\fs${effectiveFontSize}}`;
      for (let i = 0; i < flowWords.length; i++) {
        const word = flowWords[i];
        const o = overrides[word.id];
        const durationCentis = Math.max(
          1,
          Math.min(100000, Math.round((word.endMs - word.startMs) / 10))
        );
        const displayText = style.uppercase ? word.text.toUpperCase() : word.text;
        const fontKey = (o && o.font) || style.font;
        const fontName = fontNameFor(fontKey);
        const color = o && o.color != null ? toAssColor(o.color) : null;

        text += `{\\k${durationCentis}\\fn${fontName}`;
        if (color) text += `\\1c${color}`;
        text += `}${displayText}`;
        if (i !== flowWords.length - 1) text += ' ';
      }

      lines.push(
        `Dialogue: 0,${formatTime(start)},${formatTime(end)},Default,,0,0,0,,${text}`
      );
    }

    for (const word of pinnedWords) {
      const o = overrides[word.id];
      const displayText = style.uppercase ? word.text.toUpperCase() : word.text;
      const x = Math.round(videoWidth / 2 + (o.alignX || 0) * (videoWidth / 2));
      const y = Math.round(videoHeight / 2 + (o.alignY || 0) * (videoHeight / 2));
      const color = o.color != null ? toAssColor(o.color) : toAssColor(style.pillColor);
      const fontKey = o.font || style.font;
      const fontName = fontNameFor(fontKey);
      const fontSize = Math.round(style.fontSize * (o.scale || 1));

      const tag = `{\\pos(${x},${y})\\an5\\1c${color}\\fn${fontName}\\fs${fontSize}}`;
      lines.push(
        `Dialogue: 1,${formatTime(word.startMs)},${formatTime(word.endMs)},` +
          `Default,,0,0,0,,${tag}${displayText}`
      );
    }
  }

  return lines.join('\n');
}

module.exports = { generateAss };
