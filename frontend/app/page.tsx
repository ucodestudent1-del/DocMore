export default function Page() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">EveryDoc</h1>
      <p className="text-gray-600 mb-8 text-lg">
        Automated document generation and multi-format file conversion.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <a
          href="/dashboard"
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
        >
          Go to Dashboard
        </a>
        <a
          href="/convert"
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition"
        >
          Convert a File
        </a>
      </div>
    </div>
  );
}
