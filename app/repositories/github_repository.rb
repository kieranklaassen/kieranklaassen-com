# frozen_string_literal: true

require "uri"
require "yaml"

class GithubRepository
  SOURCE_PATH = Rails.root.join("content/github_repositories.yml")
  FEATURED_LIMIT = 7

  class InvalidRepositoryError < StandardError; end

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
      raise InvalidRepositoryError, "GitHub repositories must be a list" unless entries.is_a?(Array)

      repositories = entries.map.with_index { |metadata, index| load_repository(metadata, index:) }
      validate_uniqueness!(repositories)

      repositories
        .reject { |repository| repository.fetch(:fork) || repository.fetch(:archived) }
        .first(FEATURED_LIMIT)
        .map { |repository| repository.except(:fork, :archived).freeze }
        .freeze
    rescue Psych::SyntaxError => error
      raise InvalidRepositoryError, "invalid GitHub repository YAML (#{error.message})"
    end

    def load_repository(metadata, index:)
      raise InvalidRepositoryError, "GitHub repository #{index + 1} must be a mapping" unless metadata.is_a?(Hash)

      name = required_string(metadata, "name", index:)
      {
        name:,
        description: optional_string(metadata, "description", index:),
        language: optional_string(metadata, "language", index:),
        stars: required_stars(metadata, index:),
        url: required_github_url(metadata, index:),
        fork: required_boolean(metadata, "fork", index:),
        archived: required_boolean(metadata, "archived", index:)
      }.freeze
    end

    def required_string(metadata, key, index:)
      value = metadata[key]
      return value.strip if value.is_a?(String) && value.strip.present?

      raise InvalidRepositoryError, "GitHub repository #{index + 1} #{key} must be a non-empty string"
    end

    def optional_string(metadata, key, index:)
      value = metadata[key]
      return if value.nil?
      return value.strip if value.is_a?(String) && value.strip.present?

      raise InvalidRepositoryError, "GitHub repository #{index + 1} #{key} must be a non-empty string or null"
    end

    def required_stars(metadata, index:)
      value = metadata["stars"]
      return value if value.is_a?(Integer) && value >= 0

      raise InvalidRepositoryError, "GitHub repository #{index + 1} stars must be a non-negative integer"
    end

    def required_boolean(metadata, key, index:)
      value = metadata[key]
      return value if value == true || value == false

      raise InvalidRepositoryError, "GitHub repository #{index + 1} #{key} must be true or false"
    end

    def required_github_url(metadata, index:)
      value = required_string(metadata, "url", index:)
      uri = URI.parse(value)
      return value if uri.scheme == "https" && uri.host == "github.com" &&
        uri.path.match?(%r{\A/[^/]+/[^/]+\z}) &&
        uri.query.nil? && uri.fragment.nil?

      raise InvalidRepositoryError,
        "GitHub repository #{index + 1} url must be an https://github.com repository URL"
    rescue URI::InvalidURIError
      raise InvalidRepositoryError,
        "GitHub repository #{index + 1} url must be an https://github.com repository URL"
    end

    def validate_uniqueness!(repositories)
      validate_unique!(repositories, :name)
      validate_unique!(repositories, :url)
    end

    def validate_unique!(repositories, key)
      duplicates = repositories.group_by { |repository| repository.fetch(key) }
        .select { |_value, matches| matches.many? }
        .keys
      return if duplicates.empty?

      raise InvalidRepositoryError, "duplicate repository #{key}s: #{duplicates.join(', ')}"
    end
  end
end
