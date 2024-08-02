FROM node:latest

RUN npm install -g typescript

RUN corepack enable

RUN useradd -m supibot

USER supibot

WORKDIR /home/supibot

COPY --chown=supibot:supibot package.json ./
COPY --chown=supibot:supibot tsconfig.json ./
COPY --chown=supibot:supibot yarn.lock ./
COPY --chown=supibot:supibot .yarnrc.yml ./

RUN yarn

COPY --chown=supibot:supibot master.js ./
COPY --chown=supibot:supibot config-default.json ./
COPY --chown=supibot:supibot init ./init

COPY --chown=supibot:supibot api ./api
COPY --chown=supibot:supibot chat-modules ./chat-modules
COPY --chown=supibot:supibot classes ./classes
COPY --chown=supibot:supibot commands ./commands
COPY --chown=supibot:supibot crons ./crons
COPY --chown=supibot:supibot gots ./gots
COPY --chown=supibot:supibot platforms ./platforms
COPY --chown=supibot:supibot singletons ./singletons
COPY --chown=supibot:supibot utils ./utils

RUN touch db-access.js

COPY docker-entrypoint.sh /usr/local/bin/

CMD ["docker-entrypoint.sh"]

