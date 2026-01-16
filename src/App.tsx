import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import Home from './pages/user/Home';
import Profile from './pages/user/Profile';
import Cart from './pages/user/Cart';
import Checkout from './pages/user/Checkout';
import AdminDashboard from './pages/admin/AdminDashboard';
import Bills from './pages/user/Bills';

type Page = 'home' | 'profile' | 'cart' | 'checkout' | 'admin' | 'bills';

function AppContent() {
  const { profile } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>(
    profile?.role === 'admin' ? 'admin' : 'home'
  );

  const navigate = (page: Page) => {
    setCurrentPage(page);
  };

  

  if (profile?.role === 'admin') {
    return (
      <AuthGuard requireAdmin>
        <AdminDashboard />
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      {currentPage === 'home' && <Home onNavigate={navigate} />}
      {currentPage === 'profile' && <Profile onNavigate={navigate} />}
      {currentPage === 'cart' && <Cart onNavigate={navigate} />}
      {currentPage === 'checkout' && <Checkout onNavigate={navigate} />}
      {currentPage === 'bills' && <Bills onNavigate={navigate} />}
    </AuthGuard>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
