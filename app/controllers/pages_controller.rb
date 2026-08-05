# frozen_string_literal: true

class PagesController < InertiaController
  def home
    render inertia: "home", props: {
      posts: ThoughtRepository.all
    }
  end

  def about
    render inertia: "about"
  end
end
