FROM hub.kai.id/baseimage/base/dunglas/frankenphp:1-php8.4

RUN install-php-extensions \
    pdo_mysql \
    pdo_pgsql \
    gd \
    intl \
    zip \
    opcache \
    redis

RUN apt-get update && apt-get install -y supervisor inotify-tools procps
RUN apt-get install -y curl telnet
RUN apt-get install -y npm

RUN npm install n -g
RUN n stable

ARG ENV="Production"

RUN if [ "$ENV" = 'Production' ]; then \
        echo "copying php.ini for PRODUCTION"; \
        cp $PHP_INI_DIR/php.ini-production $PHP_INI_DIR/php.ini; \
    else \
        echo "copying php.ini for DEVELOPMENT"; \
        cp $PHP_INI_DIR/php.ini-development $PHP_INI_DIR/php.ini; \
    fi

WORKDIR /app

# bikin folder buat log
RUN mkdir -p /var/log/frankenphp

# install package
COPY --from=docker.io/composer:lts /usr/bin/composer /usr/bin/composer
COPY composer.* .
RUN composer install --no-dev --no-scripts --prefer-dist

# Copy file
COPY . .
COPY Caddyfile /etc/caddy/Caddyfile
COPY zz-custom-php.ini /usr/local/etc/php/conf.d/
COPY supervisord.conf /etc/supervisor/

# fix invalid cache path from composer
RUN mkdir -p ./storage/logs ./bootstrap/cache ./storage/framework/views

RUN npm ci && npm run build

# clear all cache
RUN php artisan optimize && php artisan config:clear

# run as non root user (apabila pake supervisor maka harus root)
ARG USER=www-data
ARG FIXED_ID="1000000001"

RUN \
    # Use "adduser -D ${USER}" for alpine based distros
    useradd ${USER}; \
    # set fixed ID to billion for OKD restricted uid
    usermod -u ${FIXED_ID} www-data; \
    groupmod -g ${FIXED_ID} www-data; \
    # Add additional capability to bind to port 80 and 443
    setcap CAP_NET_BIND_SERVICE=+eip /usr/local/bin/frankenphp; \
    # Give write access to /app and /app
    chown -R ${USER}:${USER} /data/caddy /config/caddy /app /var/log;

USER ${USER}

CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]
