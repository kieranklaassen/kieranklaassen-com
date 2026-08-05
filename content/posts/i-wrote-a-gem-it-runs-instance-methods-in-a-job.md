---
layout: post
title: I wrote a Gem! It runs instance_methods in a job
date: "2020-08-23"
categories: code
description: "After 12 years of Ruby, I finally wrote a gem. These are the setup, testing, and release steps I had been missing."
---

I've been writing Ruby for 12 years, but I'd never written a Ruby gem 💎! I wanted to build one I'd use myself. The point was to learn how gem internals and testing work; the functionality came second.

## Introducing the Laters Gem

🔥 You can check it out on [GitHub](https://github.com/kieranklaassen/laters).

It runs any instance method on an Active Record model in a job: add `_later` to the method name. The idea came from Action Mailer's `deliver_later`, which schedules a job instead of delivering immediately.

Here's an example of using it in a project:

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

Here's how I wrote the gem. I started with Bundler's `gem` command:

```bash
$ bundle gem laters
$ cd laters
```

You get a whole lot for free. I love this generator!

## The lib

The gem's entry point is `lib/laters.rb`.

Since my gem was going to run in a Rails environment, I added Rails as a dependency.

[laters.gemspec](https://github.com/kieranklaassen/laters/blob/master/laters.gemspec)

```gemspec
  spec.add_dependency 'rails', '>= 4.2'
```

I ended up requiring the dependencies and library files like this:

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

You can see the concern and job implementations on [GitHub](https://github.com/kieranklaassen/laters). They aren't important to the gem-creation process, so I won't cover them here.

## Test it!

Next I needed to test the functionality, so I looked at how other gem authors did it. In [Andrew Kane's Ahoy gem](https://github.com/ankane/ahoy), I found [this test helper](https://github.com/ankane/ahoy/blob/master/test/test_helper.rb#L8).

So what's [Combustion](https://github.com/pat/combustion)?

> Simple, elegant testing for Rails Engines

That sounded like what I wanted. It gives you a really nice Rails-like app inside your test suite. You can create models, a database, a controller, and jobs—whatever you need to test your gem against. It feels like adding your gem to an app's Gemfile.

With RSpec, it's super easy to set up. Run this to generate a skeleton Rails app in `spec/internal`:

```bash
$ bundle exec combust
```

Then enable it in your specs by adding the parts of Rails you need to the spec helper:

```rb
Combustion.initialize! :active_record, :action_controller
```

Then write your specs as if you were in a normal Rails app. This is great! 🔥🚀

Run the tests with:

```bash
$ rake test
```

## Release it

When everything is tested and working, you can release it. Check the version number, add a changelog if you like that sort of thing, and run:

```bash
$ rake release
```

And now it's live on [RubyGems.org/gems/laters](https://rubygems.org/gems/laters).

This is a high-level overview, and it assumes you already have a good understanding of Ruby. But these were the missing pieces I had no idea how to do before I wrote this gem. There are probably better ways to handle some of them; I got here by reading a lot of source code from gems I really like.
