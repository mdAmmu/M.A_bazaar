import Home from "../user/Home";

type Page =
  | "home"
  | "profile"
  | "cart"
  | "checkout"
  | "bills"
  | "admin"
  | "createOrder"
  | "adminOrder";

interface AdminOrderPageProps {
  orderId: string;
  onNavigate: (page: Page, id?: string) => void;
}

const AdminOrderPage = ({ orderId, onNavigate }: AdminOrderPageProps) => {
  return <Home adminMode={true} orderId={orderId} onNavigate={onNavigate} />;
};

export default AdminOrderPage;
