require "test_helper"
require "tmpdir"

class PostRepositoryTest < ActiveSupport::TestCase
  setup do
    PostRepository.reset!
  end

  test "loads the complete legacy article set newest first" do
    posts = PostRepository.all

    assert_equal 16, posts.size
    assert_equal "unlocking-ideas", posts.first.slug
    assert_equal "automatically-add-tokens-to-active-record-models", posts.last.slug
    assert_equal posts.map(&:date).sort.reverse, posts.map(&:date)
  end

  test "normalizes comma-separated categories for props" do
    post = PostRepository.all.find { |candidate| candidate.slug == "capturing-flow" }

    assert_equal [ "creativity", "technology", "productivity" ], post.categories
  end

  test "preserves Bridgetown category and date paths" do
    post = PostRepository.all.find { |candidate| candidate.slug == "filtering-noise-with-supercollider" }

    assert_equal "/code,/music/2024/03/04/filtering-noise-with-supercollider/", post.path
    assert_same post, PostRepository.find_by_path(post.path.delete_suffix("/"))
  end

  test "renders trusted embedded HTML and fenced code" do
    soundcloud = PostRepository.all.find { |candidate| candidate.slug == "filtering-noise-with-supercollider" }
    tokenizable = PostRepository.all.find { |candidate| candidate.slug == "automatically-add-tokens-to-active-record-models" }

    assert_includes soundcloud.html, '<iframe width="100%"'
    assert_includes tokenizable.html, '<pre lang="ruby"><code>'
  end

  test "every post has required metadata and a unique slug" do
    posts = PostRepository.all

    assert_equal posts.size, posts.map(&:slug).uniq.size
    posts.each do |post|
      assert_predicate post.title, :present?
      assert_predicate post.description, :present?
      assert_instance_of Date, post.date
      assert_match %r{\A/.+/\d{4}/\d{2}/\d{2}/[^/]+/\z}, post.path
    end
  end

  test "rejects a post without frontmatter" do
    Dir.mktmpdir do |directory|
      path = Pathname(directory).join("invalid.md")
      path.write("Just a body")

      error = assert_raises(PostRepository::InvalidPostError) do
        PostRepository.send(:load_post, path)
      end
      assert_match(/missing YAML frontmatter/, error.message)
    end
  end

  test "rejects invalid dates" do
    Dir.mktmpdir do |directory|
      path = Pathname(directory).join("invalid-date.md")
      path.write(post_source(date: "not-a-date"))

      error = assert_raises(PostRepository::InvalidPostError) do
        PostRepository.send(:load_post, path)
      end
      assert_match(/invalid date/, error.message)
    end
  end

  test "rejects duplicate slugs" do
    Dir.mktmpdir do |directory|
      first = Pathname(directory).join("first", "duplicate.md")
      second = Pathname(directory).join("second", "duplicate.md")
      first.dirname.mkpath
      second.dirname.mkpath
      first.write(post_source)
      second.write(post_source)

      error = assert_raises(PostRepository::InvalidPostError) do
        PostRepository.send(:load_all, [ first, second ])
      end
      assert_match(/duplicate post slugs: duplicate/, error.message)
    end
  end

  private

  def post_source(date: "2026-06-25")
    <<~MARKDOWN
      ---
      title: Test post
      date: "#{date}"
      categories: testing
      description: A test post.
      ---

      Body
    MARKDOWN
  end
end
