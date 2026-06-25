# frozen_string_literal: true

InertiaRails.configure do |config|
  config.version = -> { ViteRuby.digest }
  config.encrypt_history = true
  config.always_include_errors_hash = true
  config.use_script_element_for_initial_page = true
  config.use_data_inertia_head_attribute = true
  config.ssr_enabled = true
  config.ssr_bundle = Rails.root.join("public/vite-ssr/ssr.js").to_s
  config.ssr_url = ENV["INERTIA_SSR_URL"] if ENV["INERTIA_SSR_URL"].present?
  config.ssr_raise_on_error = Rails.env.development? || ENV["SSR_STRICT"] == "1"
  config.on_ssr_error = lambda do |error, page|
    Rails.logger.error(
      "[inertia-ssr] #{page&.dig(:component) || page&.dig('component')} render failed: " \
      "#{error.class}: #{error.message}"
    )
  end
end
