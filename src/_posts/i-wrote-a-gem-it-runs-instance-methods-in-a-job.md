---
layout: post
title: I wrote a Gem! It runs instance_methods in a job
date: "2020-08-23"
categories: code
description: "After 12 years of Ruby, I finally wrote a Gem. Here's what I learned about the art of creating tools for developers."
---

I've been writing Ruby for 12 years now but I never wrote a Ruby Gem 💎! So I set a goal for myself to write one that I would use myself. The goal of this exercise is more to see how gem internals work and how you test than the functionality of the code.

## Introducing the Laters Gem

🔥 You can check it out at [Github](https://github.com/kieranklaassen/laters).

It runs any `instance_method` of an ActiveRecord model via a job by adding `_later` to it. The inspiration is the ActionMailer way of declaring `_later` on it to schedule a job instead of it performing instantly.

This is an example how to use it on your project:

```rb
class User < ApplicationRecord
  include Laters::Concern

  after_create_commit :notify_user_later
  after_commit :refresh_cache_later

  private

  def notify_user
    # External services
    Sms.send(to: user.phone, message: 'Hey!')
  end

  def refresh_cache!
    # Expensive calculation
  end
end
```

## How to write a Gem

This is what I did to write my gem. First I used the bundler gem command to initialize a new gem to get started.

```bash
$ bundle gem laters
$ cd laters
```

You get a whole lot of work done for free! I love this generator!

## The lib

Next up, you'll write your code in the gem. The entry to the gem starts in the `lib/my_gem.rb`.

Since my gem is going to work in a Rails environment, I need to add it as a dependency.

[laters.gemspec](https://github.com/kieranklaassen/laters/blob/master/laters.gemspec)

```gemspec
  spec.add_dependency 'rails', '>= 4.2'
```

I ended up requiring my dependencies and library like this:

[lib/laters.rb](https://github.com/kieranklaassen/laters/blob/master/lib/laters.rb)

```rb
require 'active_model'
require 'active_job'
require 'laters/version'
require 'laters/concern'
require 'laters/instance_method_job'

module Laters
  class Error < StandardError; end
end
```

You can check out on [Github](https://github.com/kieranklaassen/laters) what the implementation of the concern and job are. That is not important for the Gem creation.

## Test it!

Next I wanted to test the functionality and started looking around what other do. I was looking at the [Ahoy gem by Andrew Kane](https://github.com/ankane/ahoy) and found [this test helper](https://github.com/ankane/ahoy/blob/master/test/test_helper.rb#L8)

So whats [Combustion](https://github.com/pat/combustion)?

> Simple, elegant testing for Rails Engines

That sounds like what I want. I gives you a real nice way to have a rails-like, internal app to use in your testing. You can create models, a database, a controller, jobs. Whatever you need to test your Gem against. It's like your Gem is added to this apps Gemfile.

If you use Rspec it is super easy to setup. To generate a scaffold rails app in `spec/internal` Just run:

```bash
$ bundle exec combust
```

and to enable it in your specs, add your rails-parts to the spec helper:

```rb
Combustion.initialize! :active_record, :action_controller
```

Then, write your specs like you are in a normal Rails app. This is great! 🔥🚀

To run your test you have:

```bash
$ rake test
```

## Release it

When everything is tested and works well you can release. Make sure your version is correct, you have some changelog set up if you like that sort of thing and run:

```bash
$ rake release
```

Check it out, I'm live on [RubyGems.org/gems/laters](https://rubygems.org/gems/laters)

I know this is a very high level assuming you have a good understanding of writing Ruby code. But these were the missing pieces I had no idea of how to do before I wrote this Gem. I am sure there are other ways and better ways to do certain things, but I looked at a good amount of gem source code to at least be inspired by some that I really like.
