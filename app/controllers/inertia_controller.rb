# frozen_string_literal: true

class InertiaController < ApplicationController
  LOOKS = %w[blocks long rooms name estuary score mosaic page].freeze

  before_action :remember_look
  inertia_share look: -> { look }, chooseLook: -> { cookies[:look].present? && params[:chooser] != "0" }

  private

  def look
    LOOKS.include?(cookies[:look]) ? cookies[:look] : LOOKS.first
  end

  def remember_look
    cookies[:look] = params[:look] if LOOKS.include?(params[:look])
  end
end
