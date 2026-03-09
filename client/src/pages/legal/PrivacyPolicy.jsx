import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => {
    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-12" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
            <div className="max-w-4xl mx-auto px-4">
                <div className="mb-8">
                    <Link to="/" className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">
                        <i className="fas fa-arrow-left mr-2"></i>Back to Home
                    </Link>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                        Privacy Policy
                    </h1>
                    <p className="text-gray-500 text-sm mb-8">Last updated: February 27, 2026</p>

                    <div className="prose prose-gray max-w-none space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Information We Collect</h2>
                            <h3 className="text-lg font-medium text-gray-700 mt-4 mb-2">Personal Information</h3>
                            <ul className="list-disc list-inside text-gray-600 space-y-1">
                                <li>Name, email address, phone number</li>
                                <li>Date of birth, gender</li>
                                <li>Profile photo</li>
                                <li>Government-issued ID and driver's license (for riders)</li>
                                <li>Vehicle registration and insurance documents (for riders)</li>
                            </ul>

                            <h3 className="text-lg font-medium text-gray-700 mt-4 mb-2">Usage Information</h3>
                            <ul className="list-disc list-inside text-gray-600 space-y-1">
                                <li>Ride history and booking details</li>
                                <li>Location data during active rides</li>
                                <li>Payment transaction records</li>
                                <li>Reviews and ratings</li>
                                <li>Communication logs between users</li>
                                <li>Device information and browser type</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. How We Use Your Information</h2>
                            <ul className="list-disc list-inside text-gray-600 space-y-2">
                                <li><strong>Service delivery:</strong> To match riders with passengers, process payments, and facilitate rides</li>
                                <li><strong>Safety:</strong> To verify identities, perform background checks, and enable emergency features</li>
                                <li><strong>Communication:</strong> To send booking confirmations, ride updates, and important notifications</li>
                                <li><strong>Improvement:</strong> To analyze usage patterns and improve the platform experience</li>
                                <li><strong>Legal compliance:</strong> To comply with applicable laws and respond to legal requests</li>
                                <li><strong>Carbon tracking:</strong> To calculate and display your environmental impact from shared rides</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Information Sharing</h2>
                            <p className="text-gray-600 leading-relaxed mb-3">We share your information only in the following cases:</p>
                            <ul className="list-disc list-inside text-gray-600 space-y-2">
                                <li><strong>With other users:</strong> Your name, profile photo, rating, and vehicle details are visible to co-travelers during a ride</li>
                                <li><strong>With service providers:</strong> Payment processors, email services, and cloud hosting providers who assist in operating the platform</li>
                                <li><strong>For safety:</strong> With law enforcement when required by law or to protect the safety of users</li>
                                <li><strong>With your consent:</strong> When you explicitly authorize us to share specific information</li>
                            </ul>
                            <p className="text-gray-600 leading-relaxed mt-3">
                                We do <strong>not</strong> sell your personal information to third parties for marketing purposes.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Data Storage & Security</h2>
                            <p className="text-gray-600 leading-relaxed">
                                Your data is stored on secure servers with industry-standard encryption. We use JWT-based authentication,
                                httpOnly cookies, and encrypted connections (HTTPS) to protect your information in transit. Access to
                                user data is restricted to authorized personnel on a need-to-know basis. We retain your data for as long
                                as your account is active or as needed to provide services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Location Data</h2>
                            <p className="text-gray-600 leading-relaxed">
                                We collect location data only during active rides and with your permission. Location data is used for
                                live ride tracking, distance calculation, and emergency services. You can disable location sharing
                                through your device settings, though this may limit platform functionality during rides.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Your Rights</h2>
                            <ul className="list-disc list-inside text-gray-600 space-y-2">
                                <li><strong>Access:</strong> Request a copy of your personal data</li>
                                <li><strong>Correction:</strong> Update or correct inaccurate information via your profile settings</li>
                                <li><strong>Deletion:</strong> Request account deletion through Settings &rarr; Delete Account</li>
                                <li><strong>Portability:</strong> Request your data in a machine-readable format</li>
                                <li><strong>Restriction:</strong> Request limitation of processing in certain circumstances</li>
                                <li><strong>Objection:</strong> Object to processing for direct marketing purposes</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Cookies & Tracking</h2>
                            <p className="text-gray-600 leading-relaxed">
                                We use essential cookies for authentication and session management. We do not use third-party
                                advertising cookies. Analytics cookies may be used anonymously to improve the platform. You can
                                manage cookie preferences through your browser settings.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Children's Privacy</h2>
                            <p className="text-gray-600 leading-relaxed">
                                LoopLane is not intended for users under 18 years of age. We do not knowingly collect information
                                from minors. If we discover that a minor has provided us with personal information, we will
                                promptly delete it.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Changes to This Policy</h2>
                            <p className="text-gray-600 leading-relaxed">
                                We may update this Privacy Policy periodically. We will notify you of material changes via email
                                or in-app notification. We encourage you to review this policy regularly.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Contact Us</h2>
                            <p className="text-gray-600 leading-relaxed">
                                For privacy-related inquiries, contact our Data Protection Officer at{' '}
                                <a href="mailto:privacy@looplane.in" className="text-emerald-600 hover:underline">privacy@looplane.in</a>{' '}
                                or visit our <Link to="/support" className="text-emerald-600 hover:underline">Support page</Link>.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default PrivacyPolicy;
