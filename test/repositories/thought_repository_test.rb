require "test_helper"

class ThoughtRepositoryTest < ActiveSupport::TestCase
  test "merges local and external writing in date order" do
    thoughts = ThoughtRepository.all

    assert_equal PostRepository.all.size + ExternalPostRepository.all.size, thoughts.size
    assert_equal thoughts.map { |post| post.fetch(:date) }.sort.reverse, thoughts.map { |post| post.fetch(:date) }
    assert thoughts.any? { |post| post.fetch(:slug) == "unlocking-ideas" }
    assert thoughts.any? { |post| post.fetch(:slug) == "every-compound-engineering" }
  end
end
