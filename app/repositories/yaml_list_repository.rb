# frozen_string_literal: true

require "uri"
require "yaml"

module YamlListRepository
  def all
    return load_all if Rails.env.development?

    @all ||= load_all
  end

  def reset!
    @all = nil
  end

  private

  def load_entries(path)
    entries = YAML.safe_load_file(path, permitted_classes: [], aliases: false)
    invalid!("#{self::ENTRY_NAME.pluralize} must be a list") unless entries.is_a?(Array)

    entries.map.with_index(1) do |metadata, position|
      label = "#{self::ENTRY_NAME} #{position}"
      invalid!("#{label} must be a mapping") unless metadata.is_a?(Hash)

      load_entry(metadata, label)
    end
  rescue Psych::SyntaxError => error
    invalid!("invalid #{self::ENTRY_NAME} YAML (#{error.message})")
  end

  def required_string(metadata, key, label, expected: "a non-empty string")
    value = metadata[key]
    return value.strip if value.is_a?(String) && value.strip.present?

    invalid!("#{label} #{key} must be #{expected}")
  end

  def required_url(metadata, key, label, expected:)
    value = required_string(metadata, key, label)
    return value if yield URI.parse(value)

    invalid!("#{label} #{key} must be #{expected}")
  rescue URI::InvalidURIError
    invalid!("#{label} #{key} must be #{expected}")
  end

  def validate_unique!(entries, key, name)
    duplicates = entries.map { |entry| entry.fetch(key) }.tally.select { |_value, count| count > 1 }.keys
    invalid!("duplicate #{name}s: #{duplicates.join(', ')}") if duplicates.any?
  end

  def invalid!(message)
    raise self::ENTRY_ERROR, message
  end
end
