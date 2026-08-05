# frozen_string_literal: true

class Post
  attr_reader :slug, :title, :date, :categories, :description, :ai_assisted, :html, :path

  def initialize(slug:, title:, date:, categories:, description:, ai_assisted:, html:, path:)
    @slug = slug
    @title = title
    @date = date
    @categories = categories.freeze
    @description = description
    @ai_assisted = ai_assisted
    @html = html
    @path = path
  end

  def summary
    {
      slug:,
      title:,
      date: date.iso8601,
      categories:,
      description:,
      path:
    }
  end

  def as_props
    summary.merge(ai_assisted:, html:)
  end
end
