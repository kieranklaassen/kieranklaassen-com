import React from "react"
import { Link, graphql } from "gatsby"

import Bio from "../components/bio"
import Layout from "../components/layout"
import SEO from "../components/seo"

const BlogIndex = ({ data, location }) => {
  const siteTitle = data.site.siteMetadata.title
  const posts = data.allMarkdownRemark.edges

  return (
    <Layout location={location} title={siteTitle}>
      <SEO title="All posts" />
      <Bio />
      <div className="mt-16 space-y-8">
        {posts.map(({ node }) => {
          const title = node.frontmatter.title || node.fields.slug
          return (
            <article key={node.fields.slug}>
              <p className="text-sm leading-5 text-gray-500">
                <time datetime={node.frontmatter.date}>
                  {node.frontmatter.formattedDate}
                </time>
              </p>
              <Link to={node.fields.slug}>
                <h3 className="mt-2 text-xl font-semibold leading-7 text-gray-900">
                  {title}
                </h3>
                <p
                  className="mt-3 text-base leading-6 text-gray-500"
                  dangerouslySetInnerHTML={{
                    __html: node.frontmatter.description || node.excerpt,
                  }}
                />
              </Link>
              <div className="mt-3">
                <Link
                  className="text-base font-semibold leading-6 text-green-600 transition duration-150 ease-in-out hover:text-green-500"
                  to={node.fields.slug}
                >
                  Read full story
                </Link>
              </div>
            </article>
          )
        })}
      </div>
    </Layout>
  )
}

export default BlogIndex

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
      }
    }
    allMarkdownRemark(sort: { fields: [frontmatter___date], order: DESC }) {
      edges {
        node {
          excerpt
          fields {
            slug
          }
          frontmatter {
            date
            formattedDate
            title
            description
          }
        }
      }
    }
  }
`
