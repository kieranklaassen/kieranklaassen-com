---
layout: post
title: "ToolTailor: Simplifying Ruby JSON Schema Creation"
date: "2024-08-01"
categories: ruby, ai, development
description: "Discover how ToolTailor, my latest Ruby gem, bridges the gap between Ruby methods and OpenAI's JSON schemas, streamlining AI integration for developers."
---

I created ToolTailor, a Ruby gem designed to convert Ruby methods and classes into OpenAI-compatible JSON schemas.

[https://github.com/kieranklaassen/tool_tailor](https://github.com/kieranklaassen/tool_tailor)

## The Power of ToolTailor

At its core, ToolTailor does one thing: it takes Ruby methods or classes and converts them into OpenAI-compatible JSON schemas. Here's a simple example:

```ruby
class WeatherService
  # Get the current weather in a given location.
  #
  # @param location [String] The city and state, e.g., San Francisco, CA.
  # @param unit [String] The temperature unit to use. Infer this from the user's location.
  # @values unit ["Celsius", "Fahrenheit"]
  def get_current_temperature(location:, unit:)
    # Implementation details
  end
end

schema = ToolTailor.convert(WeatherService.instance_method(:get_current_temperature))
```

With just a single line of code, we've transformed a Ruby method into a schema that OpenAI can understand and work with. It's that simple.

## Beyond Methods: Handling Classes

ToolTailor isn't limited to just methods. It can handle entire classes too:

```ruby
class User
  # Create a new user
  #
  # @param name [String] The user's name
  # @param age [Integer] The user's age
  def initialize(name:, age:)
    @name = name
    @age = age
  end
end

schema = User.to_json_schema
```

This flexibility allows us to seamlessly integrate our existing Ruby structures with OpenAI's API, opening up new possibilities for AI-powered applications.

## Real-World Application

Imagine giving an AI assistant a deep understanding of your application's structure. Here's a glimpse of what that might look like:

```ruby
response = client.chat(
  parameters: {
    model: "gpt-4",
    messages: [{ role: "user", content: "Create a user named Alice who is 30 years old" }],
    tools: [ToolTailor.convert(User)],
    tool_choice: { type: "function", function: { name: "User" } }
  }
)

# Process the AI's response and create the user
```
