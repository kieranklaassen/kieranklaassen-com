require "test_helper"
require "socket"

class InertiaSsrTimeoutTest < ActiveSupport::TestCase
  test "the renderer and Net::HTTP are wired through the timeout patch" do
    assert_includes InertiaRails::SSRRenderer.ancestors, InertiaSSRTimeout
    assert_includes Net::HTTP.singleton_class.ancestors, InertiaSSRTimeout::NetHTTPPatch
    assert_operator InertiaSSRTimeout::TIMEOUT_SECONDS, :<=, 5
  end

  test "a hung SSR process fails fast" do
    server = TCPServer.new("127.0.0.1", 0)
    port = server.addr[1]
    accept_thread = Thread.new do
      loop { server.accept }
    rescue StandardError
      nil
    end

    configuration = InertiaRails::Configuration.default
    configuration.ssr_url = "http://127.0.0.1:#{port}"
    configuration.ssr_bundle = nil
    configuration.ssr_raise_on_error = true
    renderer = InertiaRails::SSRRenderer.new(
      configuration,
      page: { component: "home", props: {}, url: "/", version: "test" }
    )

    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    error = assert_raises(InertiaRails::SSRError) { renderer.render }
    elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started

    assert_match(/timeout/i, error.message)
    assert_operator elapsed, :<, 10
  ensure
    server&.close
    accept_thread&.kill
  end
end
