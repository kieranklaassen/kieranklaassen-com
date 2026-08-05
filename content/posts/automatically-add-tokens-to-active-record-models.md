---
layout: post
title: Automatically add tokens to your ActiveRecord models with a Tokenizable concern
date: "2020-07-15"
categories: code
description: "Add opaque tokens to Rails models with a reusable ActiveSupport concern."
---

## Use case

When exposing records through an API, you may not want to identify them with incrementing IDs. A `token` field gives each Active Record an opaque public identifier, hiding its database ID and some unwanted details about your data.

## Setup

First, generate a new model with a token field:

```shell
$ rails generate model Product title description price:decimal token:string:index:null
$ rails db:migrate
```

> Make sure to `add_index` the token and set `null: false`.

[See example migration file](https://github.com/kieranklaassen/tokenizable-example/blob/master/db/migrate/20200715134857_create_products.rb)

Or add it to an existing model, then generate tokens for every record that does not have one:

```shell
$ rails generate migration addTokenToUser token:string:index
$ rails db:migrate
$ rails run User.generate_tokens!
```

> Follow this with another migration that sets the token to `null: false`.

To set it up, include the concern in the model, et voilà!

```ruby
class Product < ApplicationRecord
  include Tokenizable

  # Optionally set the token length. Default is 8
  token_length 12
end
```

## Show me the code!

The `Tokenizable` concern below handles the work and can be included in any Rails model with a `token` column.

You can also [view it on GitHub](https://github.com/kieranklaassen/tokenizable-example/blob/master/app/models/concerns/tokenizable.rb).

```ruby
#
# Add the functionality to add tokens to ActiveRecord models.
# Set `token_length 12` in your model if you want not to use the default after including the conern
# You need a database column that is named `token`
#
# @author Kieran Klaassen
#
module Tokenizable
  extend ActiveSupport::Concern

  DEFAULT_LENGTH = 8

  included do
    cattr_accessor :token_length_var
    before_create :generate_token
    validates_presence_of :token, on: :update
  end

  module ClassMethods
    # Generate tokens for all records that do not have them.
    # To be run in migration or deployment task.
    def generate_tokens!
      # Find all IDs that need tokenizing
      ids = where(token:nil).ids
      return if ids.blank?

      # Make sure we check against existing tokens to ensure token uniqueness in case Tokenizable is
      # used with a column that does not have a unique constraint set up
      existing_tokens = pluck(:token).compact

      # Generate tokens for every ID. Make sure we have no duplicates
      tokens = []
      while tokens.length < ids.length
        (ids.length - tokens.length).times do
          tokens << SecureRandom.urlsafe_base64(@token_length_var).downcase
        end
        tokens = tokens.uniq - existing_tokens
      end

      # Collect all SQL parts for use in a VALUES construct
      token_sql_parts = []
      ids.each_with_index { |id, i| token_sql_parts << "(#{id}, '#{tokens[i]}')" }

      # Generate the SQL
      ActiveRecord::Base.connection.execute(<<-sql.gsub(/\s+/, ' ').squish)
        WITH tokens(id, token) AS (VALUES #{token_sql_parts.join(',')})
        UPDATE #{table_name} tbl
          SET token=tokens.token
          FROM tokens
          WHERE tbl.id = tokens.id
      sql
    end

    private

    # Set the length of the token (in bytes converted to base64) to be generated
    #
    # @param [Integer] token_length sets the length of the token to be generated
    def token_length(token_length)
      self.token_length_var = token_length.to_i
      logger.warn "WARN: Redefining token_length from #{token_length_var} to #{token_length}" if token_length_var
      fail 'token_length must be a positive number greater than 0' if token_length_var < 1
    end
  end

  # Creates a token if not set
  def generate_token
    self.token = loop do
      token = SecureRandom.urlsafe_base64(self.class.token_length_var || DEFAULT_LENGTH).downcase
      break token unless self.class.exists?(token: token)
    end
  end
end
```
