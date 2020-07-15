import React from "react"
import { Link } from "gatsby"
import "../styles/index.css"

const Layout = ({ location, title, children }) => {
  const rootPath = `${__PATH_PREFIX__}/`
  let header

  if (location.pathname === rootPath) {
    header = (
      <h1 className="mt-8 text-6xl font-black tracking-tighter text-green-800">
        <Link to={`/`}>{title}</Link>
      </h1>
    )
  } else {
    header = (
      <h3 className="mt-8 text-3xl font-bold tracking-tighter text-green-800">
        <Link to={`/`}>{title}</Link>
      </h3>
    )
  }
  return (
    <div className="min-h-screen bg-gray-100 border-t-8 border-green-700">
      <div className="px-4 mx-auto font-sans antialiased text-gray-900 shadow bg-gray-50 max-w-7xl sm:px-6 lg:px-8">
        <div className="flex flex-col max-w-3xl mx-auto text-lg">
          <header>{header}</header>
          <main className="flex-1">{children}</main>
          <footer className="py-8 mt-12 border-t border-gray-300">
            <p className="text-base leading-6 text-gray-600 xl:text-center">
              © {new Date().getFullYear()} Kieran Klaassen
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default Layout
