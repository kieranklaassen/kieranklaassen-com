ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require "inertia_rails/minitest"

module ActiveSupport
  class TestCase
    # Run tests in parallel with specified workers
    parallelize(workers: :number_of_processors)

    # vite_ruby's build lock is per process, so workers that each find stale test
    # assets would build over one another. Build once, before they fork; the
    # lookup skips a fresh build and raises if the build failed.
    parallelize_before_fork do
      ViteRuby.instance.manifest.path_for("application", type: :stylesheet)
    end

    # Add more helper methods to be used by all tests here...
  end
end
