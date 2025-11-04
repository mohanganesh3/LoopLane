import { useState, useEffect } from 'react';
import userService from '../../services/userService';
import { Alert, Button } from '../../components/common';

const EmergencyContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    relationship: '',
    phone: '',
    email: '',
    isPrimary: false
  });
  
  // Verification modal
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyContactId, setVerifyContactId] = useState(null);
  const [verifyPhone, setVerifyPhone] = useState('');
  const [otp, setOtp] = useState('');

  const relationships = [
    'Parent', 'Sibling', 'Spouse', 'Partner', 'Friend', 'Colleague', 'Other'
  ];

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const response = await userService.getEmergencyContacts();
      if (response.success) {
        setContacts(response.contacts || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (contacts.length >= 5) {
      setError('You can only add up to 5 emergency contacts.');
      return;
    }
    
    if (!formData.name || !formData.relationship || !formData.phone) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      const response = await userService.addEmergencyContact(formData);
      if (response.success) {
        setSuccess('Emergency contact added successfully!');
        setFormData({ name: '', relationship: '', phone: '', email: '', isPrimary: false });
        loadContacts();
        
        // Prompt for verification
        if (window.confirm('Would you like to verify this contact now?')) {
          startVerification(response.contact._id, response.contact.phone);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to add contact');
    }
  };

  const startVerification = async (contactId, phone) => {
    try {
      const response = await userService.sendContactVerification(contactId);
      if (response.success) {
        setVerifyContactId(contactId);
        setVerifyPhone(phone);
        setOtp('');
        setShowVerifyModal(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to send verification code');
    }
  };

  const submitVerification = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    try {
      const response = await userService.verifyContact(verifyContactId, otp);
      if (response.success) {
        setSuccess('Contact verified successfully!');
        setShowVerifyModal(false);
        loadContacts();
      }
    } catch (err) {
      setError(err.message || 'Verification failed');
    }
  };

  const setPrimary = async (contactId) => {
    try {
      const response = await userService.setPrimaryContact(contactId);
      if (response.success) {
        setSuccess('Primary contact updated!');
        loadContacts();
      }
    } catch (err) {
      setError(err.message || 'Failed to update primary contact');
    }
  };

  const deleteContact = async (contactId) => {
    if (!window.confirm('Are you sure you want to delete this emergency contact?')) {
      return;
    }

    try {
      const response = await userService.deleteEmergencyContact(contactId);
      if (response.success) {
        setSuccess('Contact deleted successfully!');
        loadContacts();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete contact');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <span className="text-3xl mr-3">🛡️</span>
            Emergency Contacts
          </h1>
          <p className="text-gray-600 mt-2">
            Add trusted contacts who will be notified automatically if you trigger an SOS alert.
            We recommend adding at least 2-3 emergency contacts for your safety.
          </p>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError('')} className="mb-6" />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess('')} className="mb-6" />}

        {/* Info Banner */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center">
            <span className="mr-2">ℹ️</span> How it Works
          </h3>
          <ul className="text-sm text-blue-700 space-y-1 ml-6 list-disc">
            <li>When you trigger SOS, all your emergency contacts receive immediate SMS and email alerts</li>
            <li>They get your live location link, ride details, and driver information</li>
            <li>Contacts are verified via OTP to ensure they're reachable</li>
            <li>Set one contact as "Primary" for priority notifications</li>
          </ul>
        </div>

        {/* Add Contact Form */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <span className="text-2xl mr-2">➕</span> Add New Emergency Contact
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relationship <span className="text-red-500">*</span>
                </label>
                <select
                  name="relationship"
                  value={formData.relationship}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  {relationships.map(rel => (
                    <option key={rel} value={rel}>{rel}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+91 9876543210"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +91)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="john@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="isPrimary"
                checked={formData.isPrimary}
                onChange={handleInputChange}
                className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
              />
              <label className="ml-2 text-sm text-gray-700">
                Set as primary contact (receives alerts first)
              </label>
            </div>

            <Button type="submit" className="w-full md:w-auto">
              💾 Add Contact
            </Button>
          </form>
        </div>

        {/* Contacts List */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center justify-between">
            <span>
              <span className="text-2xl mr-2">👥</span>
              Your Emergency Contacts ({contacts.length}/5)
            </span>
            <span className="text-sm font-normal text-gray-500">Maximum 5 contacts</span>
          </h2>

          {contacts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl text-gray-300 mb-4">👤</div>
              <p className="text-gray-500">No emergency contacts added yet.</p>
              <p className="text-sm text-gray-400 mt-2">Add your first contact above to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => (
                <div
                  key={contact._id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-800">{contact.name}</h3>
                        {contact.isPrimary && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                            Primary
                          </span>
                        )}
                        {contact.verified ? (
                          <span className="text-green-600" title="Verified">✅</span>
                        ) : (
                          <span className="text-yellow-600" title="Not Verified">⚠️</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        👤 {contact.relationship || 'Not specified'}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        📱 {contact.phone}
                      </p>
                      {contact.email && (
                        <p className="text-sm text-gray-600">
                          📧 {contact.email}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {!contact.verified && (
                        <button
                          onClick={() => startVerification(contact._id, contact.phone)}
                          className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded transition"
                        >
                          🛡️ Verify
                        </button>
                      )}
                      {!contact.isPrimary && (
                        <button
                          onClick={() => setPrimary(contact._id)}
                          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition"
                        >
                          ⭐ Set Primary
                        </button>
                      )}
                      <button
                        onClick={() => deleteContact(contact._id)}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Safety Tips */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow-sm p-6 mt-6">
          <h3 className="font-bold text-purple-800 mb-3 flex items-center">
            <span className="text-xl mr-2">💡</span> Safety Tips
          </h3>
          <ul className="text-sm text-purple-700 space-y-2 ml-6 list-disc">
            <li>Choose contacts who are available 24/7 and can respond quickly</li>
            <li>Inform your contacts that they're listed as emergency contacts</li>
            <li>Keep their contact information up to date</li>
            <li>Verify their phone numbers to ensure SMS alerts work</li>
            <li>Consider adding contacts from different locations</li>
          </ul>
        </div>
      </div>

      {/* Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Verify Contact</h3>
            <p className="text-gray-600 mb-6">
              We've sent a verification code to <strong>{verifyPhone}</strong>
            </p>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl font-bold tracking-widest mb-4"
              placeholder="000000"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowVerifyModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={submitVerification}
                className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition"
              >
                Verify
              </button>
            </div>
            <button
              onClick={() => startVerification(verifyContactId, verifyPhone)}
              className="w-full mt-4 text-sm text-emerald-600 hover:underline"
            >
              Resend Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyContacts;
