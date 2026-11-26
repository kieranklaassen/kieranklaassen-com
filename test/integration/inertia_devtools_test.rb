require "test_helper"
require "json"
require "open3"
require "rbconfig"

class InertiaDevtoolsTest < ActionDispatch::IntegrationTest
  PATHS = %w[/_inertia/devtools/entries /_inertia/devtools/entries/example].freeze

  # Booted with the gem's own switch on, so the initializer has to win over it.
  # Only routes and middleware are read: no server starts and nothing renders.
  PROBE = <<~RUBY
    require "./config/environment"
    require "json"
    app = Rails.application
    puts JSON.generate(
      env: Rails.env,
      enabled: InertiaRails::Devtools.enabled?,
      middleware: app.middleware.map(&:name),
      controllers: ARGV.map { |path| app.routes.recognize_path(path).fetch(:controller) }
    )
  RUBY

  test "devtools paths return the app's 404" do
    PATHS.each do |path|
      get path

      assert_response :not_found
      assert_inertia_component "not_found"
      assert_nil response.headers["x-inertia-devtools-id"]
    end
  end

  %w[development test production].each do |environment|
    test "devtools is not loaded in #{environment}" do
      output, errors, status = Open3.capture3(
        {
          "RAILS_ENV" => environment,
          "SECRET_KEY_BASE_DUMMY" => "1",
          "INERTIA_DEVTOOLS_ENABLED" => "true"
        },
        RbConfig.ruby, "-e", PROBE, *PATHS, chdir: Rails.root.to_s
      )
      assert_predicate status, :success?, errors

      result = JSON.parse(output.lines.last)
      assert_equal environment, result.fetch("env")
      assert_equal false, result.fetch("enabled")
      refute_includes result.fetch("middleware"), "InertiaRails::Devtools::Middleware"
      assert_equal %w[posts posts], result.fetch("controllers")
    end
  end
end
