FROM node:24-bookworm-slim

RUN npm install -g --force corepack
RUN npm install -g typescript

RUN corepack enable

RUN useradd -m supibot
USER supibot
WORKDIR /home/project/supibot

COPY --chown=supibot:supibot package.json tsconfig.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

COPY --chown=supibot:supibot . .
RUN yarn build

COPY docker-entrypoint.sh /usr/local/bin/

CMD ["docker-entrypoint.sh"]
