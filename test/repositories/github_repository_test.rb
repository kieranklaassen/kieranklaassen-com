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

  private

  def load_entries(entries)
    Dir.mktmpdir do |directory|
      path = Pathname(directory).join("github_repositories.yml")
      path.write(entries.to_yaml)
      return GithubRepository.send(:load_all, path)
    end
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
