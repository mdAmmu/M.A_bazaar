import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthGuard } from './components/AuthGuard';
import Home from './pages/user/Home';
import Profile from './pages/user/Profile';
import Cart from './pages/user/Cart';
import Checkout from './pages/user/Checkout';
import AdminDashboard from './pages/admin/AdminDashboard';
import Bills from './pages/user/Bills';
import CreateOrder from './pages/admin/CreateOrder';
import AdminOrderPage from './pages/admin/AdminOrderPage';


type Page =
  | 'home'
  | 'profile'
  | 'cart'
  | 'checkout'
  | 'bills'
  | 'admin'
  | 'createOrder'
  | 'adminOrder';


function AppContent() {
  const { profile } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [orderId, setOrderId] = useState<string | null>(null);

  // keep page in sync with role
  useEffect(() => {
    if (profile?.role === 'admin') {
      // stay on in-progress admin flows, otherwise default to dashboard
      setCurrentPage((prev) =>
        prev === 'createOrder' || prev === 'adminOrder' ? prev : 'admin'
      );
    } else {
      setCurrentPage('home');
      setOrderId(null);
    }
  }, [profile?.role]);

  const navigate = (page: Page, id?: string) => {
    setCurrentPage(page);
    if (id) setOrderId(id);
  };



  if (profile?.role === 'admin') {
    return (
      <AuthGuard requireAdmin>
        {currentPage === 'admin' && (
          <AdminDashboard onNavigate={navigate} />
        )}

        {currentPage === 'createOrder' && (
          <CreateOrder onNavigate={navigate} />
        )}

        {/* // in the admin branch */}
        {currentPage === 'adminOrder' && orderId && (
          <AdminOrderPage orderId={orderId} onNavigate={navigate} />
        )}
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
