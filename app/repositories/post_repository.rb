# frozen_string_literal: true

require "yaml"

class PostRepository
  FRONTMATTER_PATTERN = /\A---\s*\n(?<frontmatter>.*?)\n---\s*\n(?<body>.*)\z/m
  MARKDOWN_OPTIONS = {
    render: { unsafe: true },
    extension: { tagfilter: false, header_ids: "" }
  }.freeze
  MARKDOWN_PLUGINS = { table: true, strikethrough: true, tasklist: true }.freeze

  class InvalidPostError < StandardError; end

  class << self
    def all
      return load_all if Rails.env.development?

      @all ||= load_all
    end

    def find_by_path(path)
      normalized = path.end_with?("/") ? path : "#{path}/"
      all.find { |post| post.path == normalized }
    end

    def reset!
      @all = nil
    end

    private

    def load_all(paths = Dir[Rails.root.join("content/posts/*.md")].sort)
      posts = paths.map { |path| load_post(Pathname(path)) }
      duplicate_slugs = posts.group_by(&:slug).select { |_slug, matches| matches.many? }.keys
      raise InvalidPostError, "duplicate post slugs: #{duplicate_slugs.join(', ')}" if duplicate_slugs.any?

      posts.sort_by(&:date).reverse.freeze
    end

    def load_post(path)
      source = path.read(encoding: "UTF-8")
      match = FRONTMATTER_PATTERN.match(source)
      raise InvalidPostError, "#{path.basename}: missing YAML frontmatter" unless match

      metadata = YAML.safe_load(match[:frontmatter], permitted_classes: [], aliases: false)
      raise InvalidPostError, "#{path.basename}: frontmatter must be a mapping" unless metadata.is_a?(Hash)

      title = required_string(metadata, "title", path)
      description = required_string(metadata, "description", path)
      categories_raw = required_string(metadata, "categories", path)
      date = Date.iso8601(required_string(metadata, "date", path))
      slug = path.basename(".md").to_s
      body = match[:body]

      Post.new(
        slug:,
        title:,
        date:,
        categories: categories_raw.split(",").map(&:strip).reject(&:empty?),
        description:,
        html: Commonmarker.to_html(body, options: MARKDOWN_OPTIONS, plugins: MARKDOWN_PLUGINS),
        path: legacy_path(slug:, date:, categories_raw:)
      )
    rescue Date::Error => error
      raise InvalidPostError, "#{path.basename}: invalid date (#{error.message})"
    end

    def required_string(metadata, key, path)
      value = metadata[key]
      return value.strip if value.is_a?(String) && value.strip.present?

      raise InvalidPostError, "#{path.basename}: #{key} must be a non-empty string"
    end

    def legacy_path(slug:, date:, categories_raw:)
      category_path = categories_raw.split.join("/")
      "/#{category_path}/#{date.strftime('%Y/%m/%d')}/#{slug}/"
    end
  end
end
