require "test_helper"

class LooksTest < ActionDispatch::IntegrationTest
  test "the site is as it is until a look is chosen" do
    get root_path
    assert_response :success
    refute_includes response.body, 'data-look="'
    assert_empty cookies[:look].to_s
  end

  test "a look is remembered from one page to the next" do
    get root_path(look: "estuary")
    assert_equal "estuary", cookies[:look]
    get about_path
    assert_match(/(?:"|&quot;)look(?:"|&quot;):(?:"|&quot;)estuary/, response.body)
  end

  test "a look nobody made is not taken" do
    get root_path(look: "nonsense")
    assert_empty cookies[:look].to_s
  end

  test "only the score is handed every thought" do
    get root_path(look: "page")
    refute_match(/(?:"|&quot;)score(?:"|&quot;):\[/, response.body)
    get root_path(look: "score")
    assert_match(/(?:"|&quot;)score(?:"|&quot;):\[/, response.body)
  end

  test "a look for each page gives every page its own" do
    skip "set INERTIA_SSR_URL and SSR_STRICT=1 after building the SSR bundle" unless ENV["SSR_STRICT"] == "1"

    { root_path(look: "rooms") => "name", "/posts" => "score", PostRepository.all.first.path => "estuary", about_path => "mosaic" }.each do |path, room|
      get path
      assert_includes response.body, %(class="wc-body" data-look="#{room}")
    end
  end

  test "one long page is the name, the score and the estuary" do
    skip "set INERTIA_SSR_URL and SSR_STRICT=1 after building the SSR bundle" unless ENV["SSR_STRICT"] == "1"

    get root_path(look: "long")
    assert_equal %w[wc-header wc-staff wc-river], response.body.scan(/class="(wc-header|wc-staff|wc-river)"/).flatten
  end

  test "every look is rendered on the server" do
    skip "set INERTIA_SSR_URL and SSR_STRICT=1 after building the SSR bundle" unless ENV["SSR_STRICT"] == "1"

    (InertiaController::LOOKS - [ "blocks" ]).each do |look|
      get root_path(look:)
      assert_response :success
      assert_includes response.body, %(data-look="#{look}")
      assert_includes response.body, "How I Polish Software That Agents Built"
    end
  end
end
