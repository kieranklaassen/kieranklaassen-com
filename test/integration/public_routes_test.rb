require "test_helper"

class PublicRoutesTest < ActionDispatch::IntegrationTest
  test "home exposes every post through the Inertia page" do
    get root_path

    assert_response :success
    assert_inertia_component "home"
    summaries = inertia.props.fetch("posts")
    assert_equal PostRepository.all.map(&:title), summaries.map { |post| post.fetch("title") }
    assert_equal PostRepository.all.map(&:path), summaries.map { |post| post.fetch("path") }
  end

  test "about and posts index remain public" do
    get about_path
    assert_response :success
    assert_inertia_component "about"

    get posts_path
    assert_response :success
    assert_inertia_component "posts/index"
  end

  test "every characterized Bridgetown article URL resolves" do
    PostRepository.all.each do |post|
      get post.path

      assert_response :success, post.path
      assert_inertia_component "posts/show", post.path
      assert_equal post.title, inertia.props.dig("post", "title"), post.path
    end
  end

  test "unknown paths return an Inertia 404" do
    get "/nothing-lives-here"

    assert_response :not_found
    assert_inertia_component "not_found"
    assert_equal "/nothing-lives-here", inertia.props.fetch("requestedPath")
  end

  test "health endpoint boots without a database" do
    get rails_health_check_path

    assert_response :success
  end
end
