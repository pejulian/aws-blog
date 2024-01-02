FROM node:18-alpine

RUN apk update
RUN apk add zip
RUN apk add bash
RUN apk add jq
RUN npm install -g typescript
RUN npm install -g esbuild
