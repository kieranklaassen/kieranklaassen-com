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
  end

  test "the score on the home page has every thought" do
    skip "set INERTIA_SSR_URL and SSR_STRICT=1 after building the SSR bundle" unless ENV["SSR_STRICT"] == "1"

    get root_path
    assert_equal ThoughtRepository.all.size, response.body.scan('class="wc-note"').size
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
    assert_equal 1, response.body.scan('class="painted-sheet"').size
    assert_equal 1, response.body.scan('class="wc"').size
    assert_includes response.body, 'src="https://w.soundcloud.com/player/?url='
    refute_includes response.body, 'src="[https://w.soundcloud.com/player/'
  end

  test "production client and SSR bundles exclude test files and vitest chunks" do
    skip "set INERTIA_SSR_URL and SSR_STRICT=1 after building the SSR bundle" unless ENV["SSR_STRICT"] == "1"

    manifest_path = Rails.root.join("public/vite/.vite/manifest.json")
    assert manifest_path.exist?, "expected production Vite manifest at #{manifest_path}"

    forbidden_pattern = /(?:\.test(?:[.-]|$)|(?:^|\/|_)test\.|vitest|magic-string)/i

    manifest = JSON.parse(manifest_path.read)
    assert manifest.key?("entrypoints/inertia.tsx"), "expected entrypoints/inertia.tsx in client manifest"

    manifest_paths = manifest.flat_map do |key, entry|
      [ key, entry["file"], entry["src"], *entry["dynamicImports"] ].compact
    end.uniq

    offending_client_entries = manifest_paths.grep(forbidden_pattern)
    assert_empty offending_client_entries, "unexpected test or vitest entries in client manifest: #{offending_client_entries.inspect}"

    ssr_assets_dir = Rails.root.join("public/vite-ssr/assets")
    assert ssr_assets_dir.exist?, "expected production SSR assets directory at #{ssr_assets_dir}"

    ssr_assets = Dir.children(ssr_assets_dir)
    refute_empty ssr_assets, "expected production SSR chunks in #{ssr_assets_dir}"

    offending_ssr_assets = ssr_assets.grep(forbidden_pattern)
    assert_empty offending_ssr_assets, "unexpected test or vitest chunks in SSR assets: #{offending_ssr_assets.inspect}"
  end
end
