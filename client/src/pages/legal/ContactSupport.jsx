import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';

const ContactSupport = () => {
    const [searchParams] = useSearchParams();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        category: searchParams.get('category') || '',
        subject: searchParams.get('subject') || '',
        message: ''
    });
    const [submitted, setSubmitted] = useState(false);

    const categories = [
        { value: 'account', label: 'Account Issues', icon: 'fa-user-circle' },
        { value: 'ride', label: 'Ride Problems', icon: 'fa-car' },
        { value: 'payment', label: 'Payment & Billing', icon: 'fa-credit-card' },
        { value: 'safety', label: 'Safety Concern', icon: 'fa-shield-alt' },
        { value: 'verification', label: 'Verification', icon: 'fa-id-card' },
        { value: 'feedback', label: 'Feedback & Suggestions', icon: 'fa-comment-dots' },
        { value: 'other', label: 'Other', icon: 'fa-question-circle' },
    ];

    const faqs = [
        {
            question: 'How do I verify my account?',
            answer: 'Go to Profile → Documents and upload your driver\'s license, vehicle RC, and insurance. Our team reviews documents within 24-48 hours.'
        },
        {
            question: 'How is the ride contribution calculated?',
            answer: 'Contribution = (Fuel cost × Distance) ÷ Number of passengers + Platform fee. This ensures fair cost-sharing among all travelers.'
        },
        {
            question: 'What if my rider cancels?',
            answer: 'If a rider cancels after you\'ve confirmed, you\'ll receive a full refund. The rider may receive a cancellation penalty on their profile.'
        },
        {
            question: 'How does OTP verification work?',
            answer: 'At pickup, the rider enters a 4-digit OTP shared with the passenger. At dropoff, the process repeats. This ensures secure pickup and dropoff confirmation.'
        },
        {
            question: 'How do I report a safety issue?',
            answer: 'During an active ride, use the SOS button for emergencies. After a ride, go to Booking Details → Report to file a complaint. Our safety team reviews all reports within 24 hours.'
        },
        {
            question: 'What payment methods are accepted?',
            answer: 'We currently support UPI, net banking, and cash payments. All online payments are processed through our secure payment partner.'
        },
        {
            question: 'Can I post recurring rides?',
            answer: 'Yes! When posting a ride, enable the "Recurring Ride" toggle. Select the days of the week and an end date. The system will automatically create rides on your schedule.'
        },
        {
            question: 'How do I track my carbon savings?',
            answer: 'Visit the Carbon Report page from your dashboard. It shows your total CO₂ saved, equivalent trees planted, and a detailed breakdown of each ride\'s environmental impact.'
        }
    ];

    const [expandedFaq, setExpandedFaq] = useState(null);

    useEffect(() => {
        const category = searchParams.get('category') || '';
        const subject = searchParams.get('subject') || '';
        const bookingId = searchParams.get('bookingId');

        setFormData(prev => ({
            ...prev,
            category: category || prev.category,
            subject: subject || prev.subject,
            message: bookingId && !prev.message
                ? `Booking reference: ${bookingId}\n\nPlease describe the issue you are facing.`
                : prev.message
        }));
    }, [searchParams]);

    const handleSubmit = (e) => {
        e.preventDefault();

        const selectedCategory = categories.find(cat => cat.value === formData.category)?.label || 'General Support';
        const body = [
            `Name: ${formData.name}`,
            `Email: ${formData.email}`,
            `Category: ${selectedCategory}`,
            '',
            formData.message
        ].join('\n');

        const mailtoUrl = `mailto:support@looplane.in?subject=${encodeURIComponent(formData.subject || `${selectedCategory} - LoopLane Support`)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoUrl;
        setSubmitted(true);
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-12" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
            <div className="max-w-5xl mx-auto px-4">
                <div className="mb-8">
                    <Link to="/" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">
                        <i className="fas fa-arrow-left mr-2"></i>Back to Home
                    </Link>
                </div>

                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                        Help & Support
                    </h1>
                    <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                        We're here to help. Browse our FAQ or send us a message.
                    </p>
                </div>

                {/* Quick Contact Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                    <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg transition">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <i className="fas fa-envelope text-emerald-600"></i>
                        </div>
                        <h3 className="font-semibold text-gray-800 mb-1">Email Us</h3>
                        <a href="mailto:support@looplane.in" className="text-emerald-600 text-sm hover:underline">
                            support@looplane.in
                        </a>
                    </div>
                    <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg transition">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <i className="fas fa-clock text-blue-600"></i>
                        </div>
                        <h3 className="font-semibold text-gray-800 mb-1">Response Time</h3>
                        <p className="text-gray-500 text-sm">Within 24 hours</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg transition">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <i className="fas fa-exclamation-triangle text-red-600"></i>
                        </div>
                        <h3 className="font-semibold text-gray-800 mb-1">Emergency</h3>
                        <p className="text-gray-500 text-sm">Use in-app SOS button</p>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-3">
                        {faqs.map((faq, i) => (
                            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <button
                                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition"
                                >
                                    <span className="font-medium text-gray-800">{faq.question}</span>
                                    <i className={`fas fa-chevron-down text-gray-400 transition-transform ${expandedFaq === i ? 'rotate-180' : ''}`}></i>
                                </button>
                                {expandedFaq === i && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        className="px-5 pb-5"
                                    >
                                        <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                                    </motion.div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Contact Form */}
                <div className="bg-white rounded-2xl shadow-lg p-8 md:p-10">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                        Send Us a Message
                    </h2>

                    {submitted ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="fas fa-check text-emerald-600 text-2xl"></i>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">Message Sent!</h3>
                            <p className="text-gray-500 mb-6">Your default email app should open with a pre-filled draft. Send it there if it did not send automatically.</p>
                            <button
                                onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', category: '', subject: '', message: '' }); }}
                                className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition font-medium"
                            >
                                Send Another Message
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Category Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {categories.map(cat => (
                                        <button
                                            key={cat.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, category: cat.value })}
                                            className={`p-3 rounded-lg border text-sm font-medium transition ${formData.category === cat.value
                                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                                }`}
                                        >
                                            <i className={`fas ${cat.icon} mr-2`}></i>
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                                        placeholder="Your name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                                        placeholder="your@email.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                                    placeholder="Brief description of your issue"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                <textarea
                                    required
                                    rows={5}
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition resize-none"
                                    placeholder="Describe your issue in detail..."
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition shadow-md hover:shadow-lg"
                            >
                                <i className="fas fa-paper-plane mr-2"></i>
                                Send Message
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default ContactSupport;
