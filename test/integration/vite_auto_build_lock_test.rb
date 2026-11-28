require "test_helper"
require "fileutils"
require "json"
require "logger"
require "tmpdir"

class ViteAutoBuildLockTest < ActiveSupport::TestCase
  test "ViteRuby::Manifest and ViteRuby::Builder are wired through the build lock patch" do
    assert_includes ViteRuby::Manifest.ancestors, ViteAutoBuildLock::ManifestPatch
    assert_includes ViteRuby::Builder.ancestors, ViteAutoBuildLock::BuilderPatch
  end

  test "parallel processes auto-build once and never read a half-written manifest" do
    with_isolated_vite_project do |root, build_log|
      start_reader, start_writer = IO.pipe
      ready_pipes = Array.new(4) { IO.pipe }
      result_pipes = Array.new(4) { IO.pipe }
      pids = []

      4.times do |index|
        pids << Process.fork do
          start_writer.close
          ready_pipes.each_with_index do |(r, w), i|
            r.close
            w.close unless i == index
          end
          result_pipes.each_with_index do |(r, w), i|
            r.close
            w.close unless i == index
          end

          vite = build_vite_instance(root)
          ready_pipes[index][1].write("1")
          ready_pipes[index][1].close

          start_reader.read(1)
          start_reader.close

          outcome = begin
            { ok: true, path: vite.manifest.path_for("inertia.tsx", type: :typescript) }
          rescue StandardError => error
            { ok: false, error: "#{error.class}: #{error.message}" }
          end

          Marshal.dump(outcome, result_pipes[index][1])
          result_pipes[index][1].close
          exit!(0)
        end
      end

      start_reader.close
      ready_pipes.each do |r, w|
        w.close
        r.read(1)
        r.close
      end
      result_pipes.each { |_, w| w.close }

      # Release all four processes together so they race on the cold build.
      start_writer.write("1111")
      start_writer.close

      outcomes = result_pipes.map do |r, _|
        data = Marshal.load(r.read)
        r.close
        data
      end

      pids.each { |pid| Process.waitpid(pid) }
      pids.clear

      failures = outcomes.reject { |o| o[:ok] }
      assert_empty failures, "expected all workers to resolve the entrypoint cleanly, got: #{failures.inspect}"
      assert_equal Array.new(4, "/vite-test/assets/inertia-abc123.js"), outcomes.map { |o| o[:path] }
      assert_equal 1, File.readlines(build_log).size, "expected exactly one Vite build across all workers"
    ensure
      pids&.each do |pid|
        Process.kill("KILL", pid)
      rescue Errno::ESRCH
        nil
      end
      pids&.each do |pid|
        Process.waitpid(pid)
      rescue Errno::ECHILD
        nil
      end
    end
  end

  test "manifest refresh waits for an in-flight build instead of parsing a truncated manifest" do
    with_isolated_vite_project(signal_mid_build: true) do |root, _build_log, mid_build_flag|
      vite = build_vite_instance(root)
      assert vite.builder.build, "initial build should succeed"

      FileUtils.rm_f(mid_build_flag)
      writer_pid = Process.fork do
        child_vite = build_vite_instance(root)
        child_vite.builder.build("--force")
        exit!(0)
      end

      deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 5
      until File.exist?(mid_build_flag)
        flunk "timed out waiting for writer build to truncate manifest" if Process.clock_gettime(Process::CLOCK_MONOTONIC) > deadline
        sleep 0.01
      end

      # While the writer holds the build lock and has truncated manifest.json,
      # refresh must wait for the build to finish rather than raising JSON::ParserError.
      manifest = vite.manifest.refresh
      assert_equal "/vite-test/assets/inertia-abc123.js", manifest.dig("entrypoints/inertia.tsx", "file")
    ensure
      if writer_pid
        Process.waitpid(writer_pid)
      end
    end
  end

  test "concurrent threads in one process share a single build without deadlocking" do
    with_isolated_vite_project do |root, build_log|
      vite = build_vite_instance(root)
      barrier = Queue.new
      threads = Array.new(4) do
        Thread.new do
          barrier.pop
          vite.manifest.path_for("inertia.tsx", type: :typescript)
        end
      end

      4.times { barrier << :go }
      results = threads.map(&:value)

      assert_equal Array.new(4, "/vite-test/assets/inertia-abc123.js"), results
      assert_equal 1, File.readlines(build_log).size
    end
  end

  test "production mode without auto_build reads the manifest without creating a lock file" do
    with_isolated_vite_project do |root, _build_log|
      manifest_dir = File.join(root, "public/vite/.vite")
      FileUtils.mkdir_p(manifest_dir)
      File.write(
        File.join(manifest_dir, "manifest.json"),
        JSON.generate("entrypoints/inertia.tsx" => { "file" => "assets/inertia-prod.js" })
      )

      vite = build_vite_instance(root, mode: "production", auto_build: false, public_output_dir: "vite")
      assert_equal "/vite/assets/inertia-prod.js", vite.manifest.path_for("inertia.tsx", type: :typescript)
      refute File.exist?(File.join(root, "tmp/cache/vite/build-production.lock"))
    end
  end

  private

  def with_isolated_vite_project(signal_mid_build: false)
    Dir.mktmpdir("vite-auto-build-lock-test-") do |root|
      FileUtils.mkdir_p(File.join(root, "app/frontend/entrypoints"))
      FileUtils.mkdir_p(File.join(root, "config"))
      File.write(File.join(root, "app/frontend/entrypoints/inertia.tsx"), "export {}\n")
      File.write(File.join(root, "config/vite.json"), JSON.generate({
        all: { sourceCodeDir: "app/frontend" },
        test: { autoBuild: true, publicOutputDir: "vite-test" },
        production: { autoBuild: false, publicOutputDir: "vite" }
      }))

      build_log = File.join(root, "builds.log")
      mid_build_flag = File.join(root, "mid-build.flag")
      fake_vite = File.join(root, "fake-vite")

      File.write(fake_vite, <<~RUBY)
        #!#{RbConfig.ruby}
        require "fileutils"
        require "json"

        File.open(#{build_log.inspect}, "a") { |f| f.puts(Process.pid) }
        out_dir = File.join(#{root.inspect}, "public/vite-test/.vite")
        FileUtils.mkdir_p(out_dir)
        manifest_path = File.join(out_dir, "manifest.json")

        # Truncate manifest.json to simulate Vite rewriting the output directory.
        File.write(manifest_path, "")
        File.write(#{mid_build_flag.inspect}, "1") if #{signal_mid_build.inspect}
        sleep 0.15

        File.write(manifest_path, JSON.generate(
          "entrypoints/inertia.tsx" => { "file" => "assets/inertia-abc123.js" }
        ))
      RUBY
      File.chmod(0o755, fake_vite)

      yield root, build_log, mid_build_flag
    end
  end

  def build_vite_instance(root, mode: "test", auto_build: true, public_output_dir: "vite-test")
    ViteRuby.new(
      root: root,
      mode: mode,
      auto_build: auto_build,
      public_output_dir: public_output_dir,
      skip_compatibility_check: true,
      vite_bin_path: File.join(root, "fake-vite"),
      hide_build_console_output: true
    ).tap { |vite| vite.logger = Logger.new(File::NULL) }
  end
end
