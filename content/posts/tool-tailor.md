---
layout: post
title: "ToolTailor: Simplifying Ruby JSON Schema Creation"
date: "2024-08-01"
categories: ruby, ai, development
description: "ToolTailor turns Ruby methods and classes into OpenAI-compatible JSON schemas."
ai_assisted: true
---

I built ToolTailor, a Ruby gem that converts Ruby methods and classes into OpenAI-compatible JSON schemas.

[https://github.com/kieranklaassen/tool_tailor](https://github.com/kieranklaassen/tool_tailor)

## Converting a Method

Pass a method to `ToolTailor.convert`, and it returns an OpenAI-compatible JSON schema:

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

One call turns the method into a schema OpenAI can use.

## Converting a Class

ToolTailor handles classes too:

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

This lets you use existing Ruby structures with OpenAI's API.

## Using the Schema with OpenAI

Here's how the generated schema fits into a tool call:

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
