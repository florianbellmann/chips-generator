FROM node:10

COPY package*.json ./
COPY chips ./
COPY .env ./

RUN npm install

COPY . .

CMD [ "node", "./index.js" ]
