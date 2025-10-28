import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>
        
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <nav className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'profile'
                  ? 'text-emerald-600 border-b-2 border-emerald-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Profile Info
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'settings'
                  ? 'text-emerald-600 border-b-2 border-emerald-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === 'preferences'
                  ? 'text-emerald-600 border-b-2 border-emerald-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Ride Preferences
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <p className="text-gray-500">Profile content loading...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
