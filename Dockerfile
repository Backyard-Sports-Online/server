FROM node:16

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .
COPY credentials.localdev.yaml credentials.yaml

CMD [ "node", "run.js" ]
