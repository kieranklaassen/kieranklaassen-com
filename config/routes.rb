Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  root "pages#home"
  get "about", to: "pages#about", as: :about
  get "posts", to: "posts#index", as: :posts

  # Bridgetown published posts beneath category/date/slug paths. The glob keeps
  # those URLs stable, including legacy category segments containing commas.
  get "*legacy_path", to: "posts#show", format: false
end
