FROM node:20-alpine

# ffmpeg/ffprobe — necessário pro pipeline de geração de vídeo síncrono
# (lib/media-pipeline.js, chamado por lib/auto-generate.js) rodando dentro
# do próprio processo do servidor, sem depender de rotina de nuvem.
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

# /data é onde o cadastro de usuários (users.json) fica salvo — precisa ser
# um volume persistente configurado no painel da Hostnet (App Cloud), senão
# os cadastros somem toda vez que o contêiner reiniciar/atualizar.
ENV DATA_DIR=/data
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
