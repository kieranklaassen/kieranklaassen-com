# frozen_string_literal: true

class ThoughtRepository
  class << self
    def all
      (PostRepository.all.map(&:summary) + ExternalPostRepository.all)
        .sort_by { |post| post.fetch(:date) }
        .reverse
        .freeze
    end

    def recent(limit:)
      all.first(limit).freeze
    end
  end
end
