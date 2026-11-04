import Link from "next/link";
import { useState } from "react";
import { setUserId } from "@/lib/api";

export default function Navbar() {
  const [userId, setUserIdState] = useState("");
  const [show, setShow] = useState(false);

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-indigo-600">EveryDoc</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/dashboard" className="text-gray-600 hover:text-indigo-600 font-medium">
              Dashboard
            </Link>
            <Link href="/convert" className="text-gray-600 hover:text-indigo-600 font-medium">
              Convert
            </Link>
            <Link href="/templates" className="text-gray-600 hover:text-indigo-600 font-medium">
              Templates
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {show ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">User:</span>
                <input
                  value={userId}
                  onChange={(e) => setUserIdState(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                  placeholder="user id"
                />
                <button
                  onClick={() => { setUserId(userId || "demo-user"); setShow(false); }}
                  className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                >
                  Set
                </button>
              </div>
            ) : (
              <button onClick={() => setShow(true)} className="text-sm text-gray-600 hover:text-indigo-600">
                Sign in (dev)
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
