require "test_helper"

class PostTest < ActiveSupport::TestCase
  test "summary serializes the public post fields" do
    post = PostRepository.all.first

    assert_equal post.slug, post.summary[:slug]
    assert_equal post.date.iso8601, post.summary[:date]
    assert_equal post.path, post.summary[:path]
    assert_not post.summary.key?(:html)
  end

  test "full props include rendered article HTML" do
    post = PostRepository.all.first

    assert_equal post.html, post.as_props[:html]
    assert_equal post.ai_assisted, post.as_props[:ai_assisted]
    assert_includes post.as_props[:html], "<p>"
  end

  test "summaries do not include the article-only AI disclosure flag" do
    post = PostRepository.all.first

    assert_not post.summary.key?(:ai_assisted)
  end
end
