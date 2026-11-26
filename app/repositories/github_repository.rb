# frozen_string_literal: true

class GithubRepository
  extend YamlListRepository

  class InvalidRepositoryError < StandardError; end

  SOURCE_PATH = Rails.root.join("content/github_repositories.yml")
  ENTRY_NAME = "GitHub repository"
  ENTRY_ERROR = InvalidRepositoryError
  FEATURED_LIMIT = 7

  class << self
    private

    def load_all(path = SOURCE_PATH)
      repositories = load_entries(path)
      validate_unique!(repositories, :name, "repository name")
      validate_unique!(repositories, :url, "repository url")

      repositories
        .reject { |repository| repository.fetch(:fork) || repository.fetch(:archived) }
        .first(FEATURED_LIMIT)
        .map { |repository| repository.except(:fork, :archived).freeze }
        .freeze
    end

    def load_entry(metadata, label)
      {
        name: required_string(metadata, "name", label),
        description: optional_string(metadata, "description", label),
        language: optional_string(metadata, "language", label),
        stars: required_stars(metadata, label),
        url: required_github_url(metadata, label),
        fork: required_boolean(metadata, "fork", label),
        archived: required_boolean(metadata, "archived", label)
      }.freeze
    end

    def optional_string(metadata, key, label)
      return if metadata[key].nil?

      required_string(metadata, key, label, expected: "a non-empty string or null")
    end

    def required_stars(metadata, label)
      value = metadata["stars"]
      return value if value.is_a?(Integer) && value >= 0

      invalid!("#{label} stars must be a non-negative integer")
    end

    def required_boolean(metadata, key, label)
      value = metadata[key]
      return value if value == true || value == false

      invalid!("#{label} #{key} must be true or false")
    end

    def required_github_url(metadata, label)
      required_url(metadata, "url", label, expected: "an https://github.com repository URL") do |uri|
        uri.scheme == "https" && uri.host == "github.com" &&
          uri.path.match?(%r{\A/[^/]+/[^/]+\z}) &&
          uri.query.nil? && uri.fragment.nil?
      end
    end
  end
end
