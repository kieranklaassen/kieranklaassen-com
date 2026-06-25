# frozen_string_literal: true

class PostsController < InertiaController
  def index
    render inertia: "posts/index", props: {
      posts: PostRepository.all.map(&:summary)
    }
  end

  def show
    post = PostRepository.find_by_path(request.path)
    return render_not_found unless post

    render inertia: "posts/show", props: { post: post.as_props }
  end

  private

  def render_not_found
    render inertia: "not_found", props: { requestedPath: request.path }, status: :not_found
  end
end
