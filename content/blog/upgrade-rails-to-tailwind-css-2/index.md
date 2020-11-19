---
title: How to upgrade rails to Tailwind CSS 2
date: "2020-11-19"
formattedDate: "November 19, 2020"
description: "Guide to upgrade your rails project to Tailwind CSS 2 🚀"
tags: tailwindcss2, rails, webpacker, webpack
---

## 🚀 Upgrade to Tailwind CSS v2.0 and PostCSS 8 with webpacker

### Webpacker Postcss 8 compatibility

You need to upgrade to the latest Github master version of Webpack until they released [a new version](https://github.com/rails/webpacker/issues/2782).

This will install the correct version from Github:

```bash
yarn remove @rails/webpacker
yarn add rails/webpacker
```

[Thanks, @excid3 for patching Webpacker so quickly!](https://github.com/rails/webpacker/pull/2783)

also note, your postcss.config.js should look something like this:

```js
//postcss.config.js
module.exports = {
  plugins: [
    // ...
    require("tailwindcss")("tailwind.config.js"),
    require("autoprefixer"),
    require("postcss-import"),
    require("postcss-flexbugs-fixes"),
    require("postcss-preset-env")({
      autoprefixer: {
        flexbox: "no-2009",
      },
      stage: 3,
    }),
  ],
}
```

### Updating Tailwind

```bash
yarn add tailwindcss@latest postcss@latest autoprefixer@latest
```

### (Optional) if using Tailwind UI

Remove your Tailwind UI package

```bash
yarn remove @tailwindcss/ui
```

Add new dependencies

```bash
yarn add @tailwindcss/forms @tailwindcss/typography @tailwindcss/aspect-ratio
```

Then add them to your tailwind.config.js file:

```js
// tailwind.config.js
module.exports = {
  // ...
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),
  ],
}
```

[Read more about upgrading on the official tailwind ui docs](https://tailwindui.com/changes-for-v2#updating-your-tailwind-ui-projects)

Hope this helps you and let me know if there any problems you might still have. 🚀
