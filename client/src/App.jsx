import { Link, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth, homeFor } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import DraftList from './pages/DraftList.jsx';
import NewDraft from './pages/NewDraft.jsx';
import DraftReview from './pages/DraftReview.jsx';
import Knowledge from './pages/Knowledge.jsx';
import ReviewQueue from './pages/ReviewQueue.jsx';

// "/" sends each role to its own home page.
function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={homeFor(user.role)} replace />;
}

function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6">
      <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
      <Link to="/" className="rounded text-blue-700 underline focus:outline-none focus:ring-2 focus:ring-blue-500">
        Back to home
      </Link>
    </main>
  );
}

// Route access follows the SRS 9 routes table.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Everything below needs a logged-in user and gets the navbar layout. */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<RoleHome />} />

          <Route element={<ProtectedRoute roles={['creator', 'admin']} />}>
            <Route path="/drafts" element={<DraftList />} />
            <Route path="/drafts/new" element={<NewDraft />} />
          </Route>

          <Route path="/drafts/:id" element={<DraftReview />} />
          <Route path="/knowledge" element={<Knowledge />} />

          <Route element={<ProtectedRoute roles={['reviewer', 'admin']} />}>
            <Route path="/queue" element={<ReviewQueue />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
