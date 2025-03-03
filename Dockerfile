FROM node:latest

RUN corepack enable
RUN npm install -g typescript

RUN useradd -m supibot
USER supibot
WORKDIR /home/project/supibot

COPY --chown=supibot:supibot package.json ./
COPY --chown=supibot:supibot tsconfig.json ./
COPY --chown=supibot:supibot .yarnrc.yml ./

RUN yarn install

COPY --chown=supibot:supibot master.ts ./
COPY --chown=supibot:supibot init ./init

COPY --chown=supibot:supibot @types ./@types
COPY --chown=supibot:supibot api ./api
COPY --chown=supibot:supibot chat-modules ./chat-modules
COPY --chown=supibot:supibot classes ./classes
COPY --chown=supibot:supibot commands ./commands
COPY --chown=supibot:supibot crons ./crons
COPY --chown=supibot:supibot gots ./gots
COPY --chown=supibot:supibot platforms ./platforms
COPY --chown=supibot:supibot singletons ./singletons
COPY --chown=supibot:supibot utils ./utils

COPY docker-entrypoint.sh /usr/local/bin/

CMD ["docker-entrypoint.sh"]
