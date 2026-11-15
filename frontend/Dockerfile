FROM node:22-alpine

WORKDIR /app

ARG PETAL_API_INTERNAL_URL=http://backend:8000
ENV PETAL_API_INTERNAL_URL=$PETAL_API_INTERNAL_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
