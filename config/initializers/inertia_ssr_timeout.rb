# frozen_string_literal: true

# inertia_rails delegates SSR over Net::HTTP without configurable open/read
# timeouts. Bound only that connection so a hung renderer falls back promptly
# instead of pinning a Puma thread for roughly a minute.
InertiaRails::SSRRenderer.class_eval do
  unless private_method_defined?(:request)
    raise "inertia_ssr_timeout: SSRRenderer#request changed; re-verify the timeout patch"
  end
end

module InertiaSSRTimeout
  TIMEOUT_SECONDS = Float(ENV.fetch("INERTIA_SSR_TIMEOUT", "2"))

  def request
    Thread.current[:inertia_ssr_http_active] = true
    super
  ensure
    Thread.current[:inertia_ssr_http_active] = nil
  end

  module NetHTTPPatch
    def start(address, *args, &block)
      if Thread.current[:inertia_ssr_http_active]
        options = args.last.is_a?(Hash) ? args.pop.dup : {}
        options[:open_timeout] = InertiaSSRTimeout::TIMEOUT_SECONDS
        options[:read_timeout] = InertiaSSRTimeout::TIMEOUT_SECONDS
        args.push(options)
      end

      super(address, *args, &block)
    end
  end
end

InertiaRails::SSRRenderer.prepend(InertiaSSRTimeout)
Net::HTTP.singleton_class.prepend(InertiaSSRTimeout::NetHTTPPatch)
