require "test_helper"

class InertiaSsrTest < ActionDispatch::IntegrationTest
  test "raw home HTML contains server-rendered article content" do
    skip "set INERTIA_SSR_URL and SSR_STRICT=1 after building the SSR bundle" unless ENV["SSR_STRICT"] == "1"

    get root_path

    assert_response :success
    assert_includes response.body, 'data-server-rendered="true"'
    assert_includes response.body, "Thoughts"
    assert_includes response.body, "Unlocking Ideas"
  end

  test "raw article HTML contains its body and metadata" do
    skip "set INERTIA_SSR_URL and SSR_STRICT=1 after building the SSR bundle" unless ENV["SSR_STRICT"] == "1"

    post = PostRepository.all.find { |candidate| candidate.slug == "unlocking-ideas" }
    get post.path

    assert_response :success
    assert_includes response.body, 'data-server-rendered="true"'
    assert_includes response.body, "conscious breathing"
    assert_includes response.body, post.description
  end
end
