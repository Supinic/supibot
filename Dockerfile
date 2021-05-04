FROM node:latest

RUN npm install -g typescript

RUN useradd -m supibot

USER supibot

WORKDIR /home/supibot

COPY --chown=supibot:supibot package*.json ./

RUN npm install

COPY --chown=supibot:supibot master.js ./
COPY --chown=supibot:supibot init ./init
COPY --chown=supibot:supibot api ./api
COPY --chown=supibot:supibot controllers ./controllers

RUN touch db-access.js

COPY docker-entrypoint.sh /usr/local/bin/

CMD ["docker-entrypoint.sh"]

