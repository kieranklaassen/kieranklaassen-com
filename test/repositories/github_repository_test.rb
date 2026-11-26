require "test_helper"
require "tmpdir"

class GithubRepositoryTest < ActiveSupport::TestCase
  setup do
    GithubRepository.reset!
  end

  test "loads the checked-in repository snapshot" do
    repositories = GithubRepository.all

    assert_equal 4, repositories.size
    assert_equal [ "Compound Engineering", "riffrec", "leva", "thinkroom" ],
      repositories.map { |repository| repository.fetch(:name) }
    assert repositories.frozen?
    assert repositories.all?(&:frozen?)
  end

  test "preserves pinned order while excluding ineligible repositories and limiting the result" do
    entries = 9.times.map do |index|
      repository_entry(
        name: "project-#{index}",
        stars: 9 - index
      )
    end
    entries << repository_entry(name: "archived", stars: 100, archived: true)
    entries << repository_entry(name: "forked", stars: 100, fork: true)

    repositories = load_entries(entries)

    assert_equal 7, repositories.size
    assert_equal %w[project-0 project-1 project-2 project-3 project-4 project-5 project-6],
      repositories.map { |repository| repository.fetch(:name) }
    assert repositories.all? { |repository| repository.keys == %i[name description language stars url] }
  end

  test "excludes forks and archived repositories below the limit" do
    repositories = load_entries([
      repository_entry(name: "forked", fork: true),
      repository_entry(name: "archived", archived: true),
      repository_entry(name: "kept")
    ])

    assert_equal [ "kept" ], repositories.map { |repository| repository.fetch(:name) }
  end

  test "allows a pinned repository from another GitHub organization" do
    repository = load_entries([
      repository_entry(
        name: "Compound Engineering",
        url: "https://github.com/EveryInc/compound-engineering-plugin"
      )
    ]).sole

    assert_equal "https://github.com/EveryInc/compound-engineering-plugin", repository.fetch(:url)
  end

  test "allows missing optional card metadata" do
    repository = load_entries([
      repository_entry(name: "minimal", description: nil, language: nil)
    ]).sole

    assert_nil repository.fetch(:description)
    assert_nil repository.fetch(:language)
  end

  test "returns an empty immutable collection for an empty snapshot" do
    repositories = load_entries([])

    assert_empty repositories
    assert repositories.frozen?
  end

  test "rejects duplicate names and urls" do
    duplicate_name = [ repository_entry(name: "same"), repository_entry(name: "same", stars: 2) ]
    duplicate_url = [
      repository_entry(name: "first", url: "https://github.com/kieranklaassen/shared"),
      repository_entry(name: "second", url: "https://github.com/kieranklaassen/shared")
    ]

    name_error = assert_raises(GithubRepository::InvalidRepositoryError) { load_entries(duplicate_name) }
    url_error = assert_raises(GithubRepository::InvalidRepositoryError) { load_entries(duplicate_url) }

    assert_match "duplicate repository names: same", name_error.message
    assert_match "duplicate repository urls: https://github.com/kieranklaassen/shared", url_error.message
  end

  test "rejects malformed required metadata" do
    invalid_entries = {
      "missing name" => repository_entry.except("name"),
      "foreign url" => repository_entry(url: "https://example.com/project"),
      "negative stars" => repository_entry(stars: -1),
      "string stars" => repository_entry(stars: "1"),
      "missing fork flag" => repository_entry.except("fork")
    }

    invalid_entries.each do |label, entry|
      assert_raises(GithubRepository::InvalidRepositoryError, label) { load_entries([ entry ]) }
    end
  end

  test "memoizes the repositories until reset, except in development" do
    repositories = GithubRepository.all

    assert_same repositories, GithubRepository.all
    GithubRepository.reset!
    refute_same repositories, GithubRepository.all

    with_rails_env("development") do
      refute_same GithubRepository.all, GithubRepository.all
    end
  end

  test "strips strings and accepts zero stars" do
    repository = load_entries([
      repository_entry(name: " project ", url: " https://github.com/kieranklaassen/project ",
        description: " A project ", language: " Ruby ", stars: 0)
    ]).sole

    assert_equal({
      name: "project",
      description: "A project",
      language: "Ruby",
      stars: 0,
      url: "https://github.com/kieranklaassen/project"
    }, repository)
  end

  test "rejects invalid files and entries with an exact message" do
    assert_invalid "GitHub repositories must be a list", { "name" => "project" }
    assert_invalid "GitHub repository 2 must be a mapping", [ repository_entry, "not a mapping" ]

    %w[name url].product([ nil, "", "  ", 1 ]).each do |key, value|
      assert_invalid_field "#{key} must be a non-empty string", key => value
    end
    %w[description language].product([ "", "  ", 1 ]).each do |key, value|
      assert_invalid_field "#{key} must be a non-empty string or null", key => value
    end
    [ nil, -1, 1.5, "1" ].each do |value|
      assert_invalid_field "stars must be a non-negative integer", "stars" => value
    end
    %w[fork archived].product([ nil, 1, "true" ]).each do |key, value|
      assert_invalid_field "#{key} must be true or false", key => value
    end
    [
      "http://github.com/owner/project",
      "https://gist.github.com/owner/project",
      "https://github.com/owner",
      "https://github.com/owner/project/issues",
      "https://github.com/owner/project?tab=readme",
      "https://github.com/owner/project#readme",
      "https://[bad"
    ].each do |url|
      assert_invalid_field "url must be an https://github.com repository URL", "url" => url
    end

    assert_invalid "duplicate repository names: a, b",
      %w[a b c a b].each_with_index.map { |name, index|
        repository_entry(name:, url: "https://github.com/kieranklaassen/project-#{index}")
      }

    error = assert_raises(GithubRepository::InvalidRepositoryError) { load_source("- [\n") }
    assert_match(/\Ainvalid GitHub repository YAML \(.+: did not find expected node content .+\)\z/, error.message)
    assert_instance_of Psych::SyntaxError, error.cause
  end

  private

  def assert_invalid(message, content)
    error = assert_raises(GithubRepository::InvalidRepositoryError) { load_entries(content) }
    assert_equal message, error.message
  end

  def assert_invalid_field(message, overrides)
    assert_invalid "GitHub repository 2 #{message}",
      [ repository_entry(name: "valid"), repository_entry.merge(overrides) ]
  end

  def load_entries(entries)
    load_source(entries.to_yaml)
  end

  def load_source(source)
    Dir.mktmpdir do |directory|
      path = Pathname(directory).join("github_repositories.yml")
      path.write(source)
      return GithubRepository.send(:load_all, path)
    end
  end

  def with_rails_env(name)
    original = Rails.env
    Rails.env = name
    yield
  ensure
    Rails.env = original
  end

  def repository_entry(name: "project", url: nil, description: "A project", language: "Ruby", stars: 1,
    fork: false, archived: false)
    {
      "name" => name,
      "url" => url || "https://github.com/kieranklaassen/#{name}",
      "description" => description,
      "language" => language,
      "stars" => stars,
      "fork" => fork,
      "archived" => archived
    }
  end
end
