# syntax=docker/dockerfile:1
# check=error=true

ARG RUBY_VERSION=3.4.13
# The published image the patched Ruby is compiled over (see the block below FROM).
ARG RUBY_BASE_VERSION=3.4.2
FROM docker.io/library/ruby:$RUBY_BASE_VERSION-slim AS base
# Ruby 3.4.13 is compiled from its release tarball over the ruby:$RUBY_BASE_VERSION-slim
# image, because docker.io/library/ruby:3.4.13-slim is not published yet. It fixes the
# Regexp and String vulnerabilities of 2026-11-18 (https://www.ruby-lang.org/en/news/2026/11/18/multiple-vulnerabilities-in-regexp-and-string/).
# When that image is out: delete this block and RUBY_BASE_VERSION, and build FROM
# ruby:$RUBY_VERSION-slim again. RUBY_SOURCE_VERSION has its own name because the
# base image sets ENV RUBY_VERSION, and an ENV beats an ARG of the same name.
ARG RUBY_SOURCE_VERSION=3.4.13
ARG RUBY_SOURCE_SHA256=6474dff9c02ea685fc44877a4807a27366bf109b176dad182108bb8c96d09589
RUN set -eux; \
    savedAptMark="$(apt-mark showmanual)"; \
    apt-get update -qq; \
    apt-get install --no-install-recommends -y ca-certificates dpkg-dev g++ gcc make rustc wget xz-utils \
      libffi-dev libgmp-dev libssl-dev libyaml-dev zlib1g-dev; \
    wget -qO /tmp/ruby.tar.xz "https://cache.ruby-lang.org/pub/ruby/${RUBY_SOURCE_VERSION%.*}/ruby-${RUBY_SOURCE_VERSION}.tar.xz"; \
    echo "${RUBY_SOURCE_SHA256} */tmp/ruby.tar.xz" | sha256sum --check --strict; \
    mkdir -p /usr/src/ruby; \
    tar -xJf /tmp/ruby.tar.xz -C /usr/src/ruby --strip-components=1; \
    rm /tmp/ruby.tar.xz; \
    cd /usr/src/ruby; \
    ./configure --build="$(dpkg-architecture --query DEB_BUILD_GNU_TYPE)" --disable-install-doc --enable-shared --enable-yjit; \
    make -j"$(nproc)"; \
    make install DESTDIR=/tmp/ruby-install; \
    rm -rf /usr/local/lib/ruby /usr/local/lib/libruby* /usr/local/include/ruby-*; \
    cp -a /tmp/ruby-install/usr/local/. /usr/local/; \
    rm -rf /tmp/ruby-install; \
    cd /; \
    rm -rf /usr/src/ruby; \
    apt-mark auto '.*' > /dev/null; \
    [ -z "$savedAptMark" ] || apt-mark manual $savedAptMark > /dev/null; \
    find /usr/local -type f -executable -not -path '/usr/local/bundle/*' -exec ldd '{}' ';' 2>/dev/null \
      | awk '/=>/ { so = $(NF-1); if (index(so, "/usr/local/") == 1) { next }; gsub("^/(usr/)?", "", so); printf "*%s\n", so }' \
      | sort -u | xargs -r dpkg-query --search | cut -d: -f1 | sort -u | xargs -r apt-mark manual; \
    apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false; \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*.deb; \
    ruby -e 'abort "built #{RUBY_VERSION}, wanted #{ARGV[0]}" unless RUBY_VERSION == ARGV[0]' "$RUBY_SOURCE_VERSION"; \
    ruby --yjit -e 'abort "no YJIT" unless RubyVM::YJIT.enabled?'; \
    gem --version; bundle --version
ENV RUBY_VERSION=$RUBY_SOURCE_VERSION \
    RUBY_DOWNLOAD_URL=https://cache.ruby-lang.org/pub/ruby/3.4/ruby-$RUBY_SOURCE_VERSION.tar.xz \
    RUBY_DOWNLOAD_SHA256=$RUBY_SOURCE_SHA256


WORKDIR /rails

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libjemalloc2 && \
    ln -s /usr/lib/$(uname -m)-linux-gnu/libjemalloc.so.2 /usr/local/lib/libjemalloc.so && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development:test" \
    LD_PRELOAD="/usr/local/lib/libjemalloc.so"

FROM base AS build

ARG NODE_VERSION=22
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git libyaml-dev pkg-config curl && \
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install --no-install-recommends -y nodejs && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY Gemfile Gemfile.lock ./
RUN bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git && \
    bundle exec bootsnap precompile -j 1 --gemfile

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN bundle exec bootsnap precompile -j 1 app/ lib/
RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile
RUN npx vite build --ssr && rm -rf node_modules

FROM base

ARG NODE_VERSION=22
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install --no-install-recommends -y nodejs && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash
USER 1000:1000

COPY --chown=rails:rails --from=build "${BUNDLE_PATH}" "${BUNDLE_PATH}"
COPY --chown=rails:rails --from=build /rails /rails

ENTRYPOINT ["/rails/bin/docker-entrypoint"]

EXPOSE 80
CMD ["./bin/thrust", "./bin/rails", "server"]
