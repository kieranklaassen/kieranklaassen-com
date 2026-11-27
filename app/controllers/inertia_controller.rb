# frozen_string_literal: true

class InertiaController < ApplicationController
  LOOKS = %w[long rooms name estuary score mosaic page blocks].freeze

  ARTS = %w[wide book around river].freeze

  before_action :remember_look
  inertia_share look: -> { look }, art: -> { art }, chooseLook: -> { cookies[:look].present? && params[:chooser] != "0" }

  private

  def look
    LOOKS.include?(cookies[:look]) ? cookies[:look] : LOOKS.first
  end

  def art
    ARTS.include?(cookies[:art]) ? cookies[:art] : ARTS.first
  end

  def remember_look
    cookies[:art] = params[:art] if ARTS.include?(params[:art])
    cookies[:look] = params[:look] if LOOKS.include?(params[:look])
  end
end
