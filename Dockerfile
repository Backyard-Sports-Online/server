FROM node:16

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

ARG CREDENTIALS_FILE=credentials.localdev.yaml
COPY ${CREDENTIALS_FILE} credentials.yaml

CMD [ "node", "run.js" ]
