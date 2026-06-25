# frozen_string_literal: true

class Post
  attr_reader :slug, :title, :date, :categories, :description, :html, :path

  def initialize(slug:, title:, date:, categories:, description:, html:, path:)
    @slug = slug
    @title = title
    @date = date
    @categories = categories.freeze
    @description = description
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
    summary.merge(html:)
  end
end
