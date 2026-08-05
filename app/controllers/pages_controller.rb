# frozen_string_literal: true

class PagesController < InertiaController
  def home
    render inertia: "home", props: {
      posts: ThoughtRepository.recent(limit: 7),
      repositories: GithubRepository.all
    }
  end

  def about
    render inertia: "about"
  end
end
