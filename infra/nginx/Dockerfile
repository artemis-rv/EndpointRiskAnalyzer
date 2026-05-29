FROM nginx:stable-alpine

COPY infra/nginx/riskintel.prod.conf /etc/nginx/conf.d/default.conf

COPY frontend/build /usr/share/nginx/html

COPY infra/certs /etc/nginx/certs

EXPOSE 80
EXPOSE 443
