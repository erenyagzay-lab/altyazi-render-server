FROM node:20-bookworm-slim

# ffmpeg + node-canvas'ın derlenmesi + fontconfig için gereken sistem
# kütüphaneleri
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fontconfig \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# KRİTİK ADIM: Fontları BUILD SIRASINDA indirip sisteme kalıcı olarak
# kuruyoruz. Bir font indirilemezse bu adım (ve dolayısıyla deploy)
# hemen, görünür şekilde başarısız olur — Android'de yaşadığımız
# "çalışırken sessizce bozulma" sorununun tam tersi bir güvenlik.
RUN node scripts/fetch-fonts.js && fc-cache -f

EXPOSE 3000

CMD ["npm", "start"]
