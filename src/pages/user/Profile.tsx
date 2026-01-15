import { useState, useEffect } from 'react';
import { ArrowLeft, User, LogOut, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type Page = 'home' | 'profile' | 'cart' | 'checkout' | 'admin' | 'bills';

interface ProfileProps {
  onNavigate: (page: Page) => void;
}

export default function Profile({ onNavigate }: ProfileProps) {
  const { profile, updateProfile, signOut } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    avatar_url: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        address: profile.address || '',
        avatar_url: profile.avatar_url || '',
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateProfile(formData);
      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await signOut();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-md p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              {formData.avatar_url ? (
                <img
                  src={formData.avatar_url}
                  alt="Profile"
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-blue-600 flex items-center justify-center">
                  <User className="h-12 w-12 text-white" />
                </div>
              )}
              {isEditing && (
                <button className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full text-white hover:bg-blue-700 transition">
                  <Camera className="h-4 w-4" />
                </button>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-4">
              {profile?.name}
            </h1>
            <p className="text-gray-600">{profile?.email}</p>
          </div>

          

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={!isEditing}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-600"
                required={isEditing}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Email cannot be changed
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                disabled={!isEditing}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-600"
                placeholder="+1 234 567 8900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                disabled={!isEditing}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-600"
                placeholder="123 Main St, City, State, ZIP"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Image URL
              </label>
              <input
                type="url"
                value={formData.avatar_url}
                onChange={(e) =>
                  setFormData({ ...formData, avatar_url: e.target.value })
                }
                disabled={!isEditing}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-600"
                placeholder="https://example.com/photo.jpg"
              />
            </div>

            {isEditing && (
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    if (profile) {
                      setFormData({
                        name: profile.name || '',
                        email: profile.email || '',
                        phone: profile.phone || '',
                        address: profile.address || '',
                        avatar_url: profile.avatar_url || '',
                      });
                    }
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </form>

          {!isEditing && (
            <div className="mt-6">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setIsEditing(true);
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Edit Profile
              </button>
            </div>
          )}



          

          <div className="mt-8 pt-8 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
