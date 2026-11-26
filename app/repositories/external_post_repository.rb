# frozen_string_literal: true

class ExternalPostRepository
  extend YamlListRepository

  class InvalidExternalPostError < StandardError; end

  SOURCE_PATH = Rails.root.join("content/external_posts.yml")
  ENTRY_NAME = "external post"
  ENTRY_ERROR = InvalidExternalPostError

  class << self
    private

    def load_all(path = SOURCE_PATH)
      posts = load_entries(path)
      validate_unique!(posts, :slug, "external post slug")

      posts.sort_by { |post| post.fetch(:date) }.reverse.freeze
    end

    def load_entry(metadata, label)
      slug = required_string(metadata, "slug", label)
      title = required_string(metadata, "title", label)
      date = Date.iso8601(required_string(metadata, "date", label))
      description = required_string(metadata, "description", label)
      external_url = required_url(metadata, "external_url", label, expected: "an https://every.to URL") do |uri|
        uri.scheme == "https" && uri.host == "every.to"
      end

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
      invalid!("#{label} has an invalid date (#{error.message})")
    end
  end
end
