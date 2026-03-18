import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from '../../components/common';
import { ClayCard, ClayButton, ClayInput } from '../../components/clay';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const Wallet = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/user/wallet');
      if (response.data.success) {
        setWalletData(response.data.wallet);
        setTransactions(response.data.transactions || []);
      }
    } catch (err) {
      // Initialize with default wallet data if endpoint doesn't exist yet
      setWalletData({
        balance: user?.wallet?.balance || 500,
        totalAdded: user?.wallet?.totalAdded || 500,
        totalSpent: user?.wallet?.totalSpent || 0
      });
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async () => {
    const amount = parseFloat(addAmount);
    if (!amount || amount < 100 || amount > 10000) {
      setNotification({ type: 'error', message: 'Enter an amount between ₹100 and ₹10,000' });
      return;
    }

    setProcessing(true);
    try {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      try {
        await api.post('/api/user/wallet/add', { amount });
      } catch {
        // Simulate locally if endpoint doesn't exist
      }

      setWalletData(prev => ({
        ...prev,
        balance: (prev?.balance || 0) + amount,
        totalAdded: (prev?.totalAdded || 0) + amount
      }));
      setTransactions(prev => [{
        _id: Date.now().toString(),
        type: 'CREDIT',
        amount,
        description: 'Wallet top-up',
        method: 'Simulated',
        createdAt: new Date().toISOString()
      }, ...prev]);
      setNotification({ type: 'success', message: `₹${amount} added to wallet!` });
      setShowAddFunds(false);
      setAddAmount('');
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to add funds' });
    } finally {
      setProcessing(false);
    }
  };

  const quickAmounts = [100, 250, 500, 1000, 2000];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen pb-12"
      style={{ background: 'var(--ll-cream, #f5f0e8)' }}
    >
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link to="/dashboard" className="text-emerald-500 hover:text-emerald-700 text-sm mb-4 inline-block">
            <i className="fas fa-arrow-left mr-2"></i>Back to Dashboard
          </Link>
          <h1
            className="text-3xl font-bold text-gray-800"
            style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}
          >
            <i className="fas fa-wallet text-emerald-500 mr-3"></i>My Wallet
          </h1>
        </motion.div>

        {/* Notification */}
        {notification && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            {notification.message}
            <button onClick={() => setNotification(null)} className="ml-auto"><i className="fas fa-times"></i></button>
          </div>
        )}

        {/* Simulation Banner */}
        <ClayCard variant="flat" padding="sm" className="mb-6">
          <div className="flex items-center gap-3">
            <i className="fas fa-flask text-blue-600"></i>
            <p className="text-sm text-blue-700">
              <span className="font-semibold">Simulation Mode</span> — Wallet balance is simulated. No real transactions occur.
            </p>
          </div>
        </ClayCard>

        {/* Balance Card */}
        <ClayCard variant="emerald" padding="lg" className="mb-6">
          <p className="text-emerald-100 text-sm font-medium mb-1">Available Balance</p>
          <p className="text-4xl font-bold text-white mb-4">₹{(walletData?.balance || 0).toLocaleString()}</p>
          <div className="flex gap-4 text-sm text-white">
            <div>
              <p className="text-emerald-200 text-xs">Total Added</p>
              <p className="font-semibold">₹{(walletData?.totalAdded || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-emerald-200 text-xs">Total Spent</p>
              <p className="font-semibold">₹{(walletData?.totalSpent || 0).toLocaleString()}</p>
            </div>
          </div>
          <ClayButton
            variant="glass"
            fullWidth
            className="mt-4"
            onClick={() => setShowAddFunds(true)}
          >
            <i className="fas fa-plus-circle mr-2"></i>Add Funds
          </ClayButton>
        </ClayCard>

        {/* Add Funds Modal */}
        <AnimatePresence>
          {showAddFunds && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            >
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
                <ClayCard variant="default" padding="lg" className="max-w-md w-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3
                      className="text-xl font-bold text-gray-800"
                      style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}
                    >
                      Add Funds
                    </h3>
                    <ClayButton variant="ghost" size="icon" onClick={() => setShowAddFunds(false)}>
                      <i className="fas fa-times"></i>
                    </ClayButton>
                  </div>

                  <ClayCard variant="flat" padding="sm" className="mb-4">
                    <p className="text-xs text-blue-700">
                      <i className="fas fa-flask mr-1"></i>Simulation — no real charges will occur
                    </p>
                  </ClayCard>

                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                  <div className="relative mb-3">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₹</span>
                    <input
                      type="number"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      placeholder="Enter amount"
                      min="100"
                      max="10000"
                      className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-lg font-semibold bg-white/60"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {quickAmounts.map(amt => (
                      <ClayButton
                        key={amt}
                        variant={addAmount === amt.toString() ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setAddAmount(amt.toString())}
                      >
                        ₹{amt}
                      </ClayButton>
                    ))}
                  </div>

                  <ClayButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    loading={processing}
                    onClick={handleAddFunds}
                  >
                    <i className="fas fa-plus-circle mr-2"></i>Add ₹{addAmount || '0'}
                  </ClayButton>
                </ClayCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transaction History */}
        <ClayCard variant="default" padding="lg">
          <h2
            className="text-lg font-bold text-gray-800 mb-4"
            style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}
          >
            <i className="fas fa-history text-emerald-500 mr-2"></i>Recent Transactions
          </h2>

          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-receipt text-gray-400 text-2xl"></i>
              </div>
              <p className="text-gray-500">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map(txn => (
                <div key={txn._id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      txn.type === 'CREDIT' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      <i className={`fas ${
                        txn.type === 'CREDIT' ? 'fa-arrow-down text-green-600' : 'fa-arrow-up text-red-600'
                      }`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{txn.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(txn.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                        {txn.method && ` • ${txn.method}`}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold ${
                    txn.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {txn.type === 'CREDIT' ? '+' : '-'}₹{txn.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ClayCard>
      </div>
    </motion.div>
  );
};

export default Wallet;
