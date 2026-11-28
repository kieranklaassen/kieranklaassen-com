# frozen_string_literal: true

require "pathname"

# vite_ruby guards autoBuild with a per-process Mutex on ViteRuby::Manifest,
# so parallel test workers concurrently run `vite build` into the same output
# directory while siblings read manifest.json mid-write. Synchronize builds and
# auto-build manifest reads across processes and threads via flock.
ViteRuby::Manifest.class_eval do
  unless protected_method_defined?(:lookup) && private_method_defined?(:load_manifest)
    raise "vite_auto_build_lock: ViteRuby::Manifest#lookup or #load_manifest changed; re-verify the lock patch"
  end
end

ViteRuby::Builder.class_eval do
  unless method_defined?(:build)
    raise "vite_auto_build_lock: ViteRuby::Builder#build changed; re-verify the lock patch"
  end
end

module ViteAutoBuildLock
  THREAD_KEY = :vite_auto_build_locks

  def self.lock_path_for(config, ssr: false)
    Pathname(config.build_cache_dir).join("build#{"-ssr" if ssr}-#{config.mode}.lock")
  end

  def self.synchronize(config, mode: File::LOCK_EX, ssr: false)
    path = lock_path_for(config, ssr: ssr)
    key = path.to_s
    held = (Thread.current[THREAD_KEY] ||= {})
    current = held[key]

    if current && current[0] == Process.pid
      return yield if current[1] == File::LOCK_EX || current[1] == mode

      raise "vite_auto_build_lock: cannot upgrade shared lock to exclusive on #{key}"
    end

    path.dirname.mkpath
    File.open(path, File::RDWR | File::CREAT) do |file|
      file.flock(mode)
      held[key] = [ Process.pid, mode ]
      begin
        yield
      ensure
        held.delete(key)
        Thread.current[THREAD_KEY] = nil if held.empty?
        file.flock(File::LOCK_UN)
      end
    end
  end

  module ManifestPatch
    protected

    def lookup(name, **options)
      return super unless should_build?

      ViteAutoBuildLock.synchronize(config, mode: File::LOCK_EX) { super }
    end

    private

    def load_manifest
      return super unless config.auto_build

      ViteAutoBuildLock.synchronize(config, mode: File::LOCK_SH) { super }
    end
  end

  module BuilderPatch
    def build(*args)
      ViteAutoBuildLock.synchronize(config, mode: File::LOCK_EX, ssr: args.include?("--ssr")) { super }
    end
  end
end

ViteRuby::Manifest.prepend(ViteAutoBuildLock::ManifestPatch)
ViteRuby::Builder.prepend(ViteAutoBuildLock::BuilderPatch)
