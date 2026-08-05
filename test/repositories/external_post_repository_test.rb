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
end
