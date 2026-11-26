require "test_helper"
require "tmpdir"

class ExternalPostRepositoryTest < ActiveSupport::TestCase
  setup do
    ExternalPostRepository.reset!
  end

  test "loads one external card for each unique Every work" do
    posts = ExternalPostRepository.all

    assert_equal 13, posts.size
    assert_equal "How I Polish Software That Agents Built", posts.first.fetch(:title)
    assert_equal posts.map { |post| post.fetch(:title) }.uniq.size, posts.size
    assert_equal posts.map { |post| post.fetch(:date) }.sort.reverse, posts.map { |post| post.fetch(:date) }
  end

  test "exposes only verified Every links" do
    ExternalPostRepository.all.each do |post|
      assert_equal post.fetch(:external_url), post.fetch(:path)
      assert_match %r{\Ahttps://every\.to/}, post.fetch(:external_url)
      assert_equal [ "Every" ], post.fetch(:categories)
    end
  end

  test "rejects links outside Every" do
    Dir.mktmpdir do |directory|
      path = Pathname(directory).join("external_posts.yml")
      path.write(<<~YAML)
        - slug: elsewhere
          title: Elsewhere
          date: "2026-08-05"
          description: Not an Every article.
          external_url: https://example.com/article
      YAML

      error = assert_raises(ExternalPostRepository::InvalidExternalPostError) do
        ExternalPostRepository.send(:load_all, path)
      end

      assert_match(%r{external_url must be an https://every\.to URL}, error.message)
    end
  end

  test "memoizes the posts until reset, except in development" do
    posts = ExternalPostRepository.all

    assert_same posts, ExternalPostRepository.all
    ExternalPostRepository.reset!
    refute_same posts, ExternalPostRepository.all

    with_rails_env("development") do
      refute_same ExternalPostRepository.all, ExternalPostRepository.all
    end
  end

  test "returns stripped, frozen posts newest first" do
    posts = load_entries([
      post_entry("slug" => " older ", "title" => " Older ", "date" => " 2026-08-04 ",
        "description" => " First. ", "external_url" => " https://every.to/older "),
      post_entry("slug" => "newer", "date" => "2026-08-05")
    ])

    assert_equal %w[newer older], posts.map { |post| post.fetch(:slug) }
    assert_equal({
      slug: "older",
      title: "Older",
      date: "2026-08-04",
      categories: [ "Every" ],
      description: "First.",
      path: "https://every.to/older",
      external_url: "https://every.to/older"
    }, posts.last)
    assert posts.frozen?
    assert posts.all?(&:frozen?)
    assert posts.all? { |post| post.fetch(:categories).frozen? }
  end

  test "rejects invalid files and entries with an exact message" do
    assert_invalid "external posts must be a list", { "slug" => "a" }
    assert_invalid "external post 2 must be a mapping", [ post_entry, "not a mapping" ]

    %w[slug title date description external_url].each do |key|
      [ nil, "", "  ", 1 ].each do |value|
        assert_invalid "external post 2 #{key} must be a non-empty string", [ post_entry, post_entry(key => value) ]
      end
    end

    assert_invalid "external post 2 has an invalid date (invalid date)",
      [ post_entry, post_entry("date" => "2026-13-01") ]

    [ "http://every.to/a", "https://www.every.to/a", "every.to/a", "https://[bad" ].each do |url|
      assert_invalid "external post 2 external_url must be an https://every.to URL",
        [ post_entry, post_entry("external_url" => url) ]
    end

    assert_invalid "duplicate external post slugs: a, b",
      %w[a b c a b].map { |slug| post_entry("slug" => slug) }

    error = assert_raises(ExternalPostRepository::InvalidExternalPostError) { load_source("- [\n") }
    assert_match(/\Ainvalid external post YAML \(.+: did not find expected node content .+\)\z/, error.message)
    assert_instance_of Psych::SyntaxError, error.cause
  end

  private

  def assert_invalid(message, content)
    error = assert_raises(ExternalPostRepository::InvalidExternalPostError) { load_entries(content) }
    assert_equal message, error.message
  end

  def load_entries(content)
    load_source(content.to_yaml)
  end

  def load_source(source)
    Dir.mktmpdir do |directory|
      path = Pathname(directory).join("external_posts.yml")
      path.write(source)
      ExternalPostRepository.send(:load_all, path)
    end
  end

  def post_entry(overrides = {})
    {
      "slug" => "post",
      "title" => "Post",
      "date" => "2026-08-05",
      "description" => "An Every article.",
      "external_url" => "https://every.to/post"
    }.merge(overrides)
  end

  def with_rails_env(name)
    original = Rails.env
    Rails.env = name
    yield
  ensure
    Rails.env = original
  end
end
