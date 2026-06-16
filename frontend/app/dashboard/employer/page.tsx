import { useEffect, useState } from 'react';

function handleCreateJobPosting() {
  window.location.href = 'http://localhost:3000/dashboard/employer/jobs';
}

export default function EmployerDashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Employer Dashboard</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold mb-4">Welcome, Employer!</h2>
        <p className="text-slate-400">
          This is your employer dashboard. Here you can manage your job postings, review applications, and connect with potential candidates.
        </p>

        <button className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-lg transition-colors" onClick={handleCreateJobPosting}>
          Create Job Posting
        </button>
      </main>
    </div>
  );
}