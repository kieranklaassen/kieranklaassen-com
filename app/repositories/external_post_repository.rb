# frozen_string_literal: true

require "uri"
require "yaml"

class ExternalPostRepository
  SOURCE_PATH = Rails.root.join("content/external_posts.yml")

  class InvalidExternalPostError < StandardError; end

  class << self
    def all
      return load_all if Rails.env.development?

      @all ||= load_all
    end

    def reset!
      @all = nil
    end

    private

    def load_all(path = SOURCE_PATH)
      entries = YAML.safe_load_file(path, permitted_classes: [], aliases: false)
      raise InvalidExternalPostError, "external posts must be a list" unless entries.is_a?(Array)

      posts = entries.map.with_index { |metadata, index| load_post(metadata, index:) }
      duplicate_slugs = posts.group_by { |post| post.fetch(:slug) }.select { |_slug, matches| matches.many? }.keys
      raise InvalidExternalPostError, "duplicate external post slugs: #{duplicate_slugs.join(', ')}" if duplicate_slugs.any?

      posts.sort_by { |post| post.fetch(:date) }.reverse.freeze
    rescue Psych::SyntaxError => error
      raise InvalidExternalPostError, "invalid external post YAML (#{error.message})"
    end

    def load_post(metadata, index:)
      raise InvalidExternalPostError, "external post #{index + 1} must be a mapping" unless metadata.is_a?(Hash)

      slug = required_string(metadata, "slug", index:)
      title = required_string(metadata, "title", index:)
      date = Date.iso8601(required_string(metadata, "date", index:))
      description = required_string(metadata, "description", index:)
      external_url = required_every_url(metadata, index:)

      {
        slug:,
        title:,
        date: date.iso8601,
        categories: [ "Every" ].freeze,
        description:,
        path: external_url,
        external_url:
      }.freeze
    rescue Date::Error => error
      raise InvalidExternalPostError, "external post #{index + 1} has an invalid date (#{error.message})"
    end

    def required_string(metadata, key, index:)
      value = metadata[key]
      return value.strip if value.is_a?(String) && value.strip.present?

      raise InvalidExternalPostError, "external post #{index + 1} #{key} must be a non-empty string"
    end

    def required_every_url(metadata, index:)
      value = required_string(metadata, "external_url", index:)
      uri = URI.parse(value)
      return value if uri.scheme == "https" && uri.host == "every.to"

      raise InvalidExternalPostError, "external post #{index + 1} external_url must be an https://every.to URL"
    rescue URI::InvalidURIError
      raise InvalidExternalPostError, "external post #{index + 1} external_url must be an https://every.to URL"
    end
  end
end
