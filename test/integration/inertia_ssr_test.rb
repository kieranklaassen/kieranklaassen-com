require "test_helper"

class InertiaSsrTest < ActionDispatch::IntegrationTest
  test "raw home HTML contains server-rendered article content" do
    skip "set INERTIA_SSR_URL and SSR_STRICT=1 after building the SSR bundle" unless ENV["SSR_STRICT"] == "1"

    get root_path

    assert_response :success
    assert_includes response.body, 'data-server-rendered="true"'
    assert_includes response.body, "Thoughts"
    assert_includes response.body, "Code"
    assert_includes response.body, "How I Polish Software That Agents Built"
    assert_includes response.body, "leva"
    assert_includes response.body, 'target="_blank"'
    assert_includes response.body, ThoughtRepository.recent(limit: 7).last.fetch(:title)
    refute_includes response.body, ThoughtRepository.all.fetch(7).fetch(:title)
  end

  test "raw article HTML contains its body and metadata" do
    skip "set INERTIA_SSR_URL and SSR_STRICT=1 after building the SSR bundle" unless ENV["SSR_STRICT"] == "1"

    post = PostRepository.all.find { |candidate| candidate.slug == "unlocking-ideas" }
    get post.path

    assert_response :success
    assert_includes response.body, 'data-server-rendered="true"'
    assert_includes response.body, "conscious breathing"
    assert_includes response.body, post.description
    assert_includes response.body, "AI-assisted writing. The original ideas and experiences are mine."
  end

  test "systems article includes one persistent shell and a valid media player" do
    skip "set INERTIA_SSR_URL and SSR_STRICT=1 after building the SSR bundle" unless ENV["SSR_STRICT"] == "1"

    post = PostRepository.all.find do |candidate|
      candidate.slug == "systems-structure-and-creative-freedom"
    end
    get post.path

    assert_response :success
    assert_equal 1, response.body.scan('class="site-shell"').size
    assert_includes response.body, '<filter id="square-noise">'
    assert_includes response.body, 'style="filter:url(#square-noise)"'
    assert_includes response.body, 'src="https://w.soundcloud.com/player/?url='
    refute_includes response.body, 'src="[https://w.soundcloud.com/player/'
  end
end
