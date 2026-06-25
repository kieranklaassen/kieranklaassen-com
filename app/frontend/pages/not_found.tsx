import { Head, Link } from '@inertiajs/react'

export default function NotFound({ requestedPath }: { requestedPath: string }) {
  return (
    <>
      <Head title="Page not found" />
      <section className="glass-panel mx-auto mt-8 max-w-[670px] px-8 py-16 text-center">
        <p className="text-sm font-semibold tracking-widest text-gray-500 uppercase">404</p>
        <h2 className="mt-3 text-4xl font-bold tracking-tight">That page wandered off.</h2>
        <p className="mt-4 text-gray-700">
          Nothing lives at <code>{requestedPath}</code>.
        </p>
        <Link href="/" className="mt-8 inline-block font-semibold underline underline-offset-4">
          Return home
        </Link>
      </section>
    </>
  )
}
