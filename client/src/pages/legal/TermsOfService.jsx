import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const TermsOfService = () => {
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
                        Terms of Service
                    </h1>
                    <p className="text-gray-500 text-sm mb-8">Last updated: February 27, 2026</p>

                    <div className="prose prose-gray max-w-none space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Acceptance of Terms</h2>
                            <p className="text-gray-600 leading-relaxed">
                                By accessing or using LoopLane ("the Platform"), you agree to be bound by these Terms of Service.
                                If you do not agree to these terms, please do not use the Platform. LoopLane provides a carpooling
                                marketplace that connects riders offering seats in their vehicles with passengers seeking shared rides.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Eligibility</h2>
                            <p className="text-gray-600 leading-relaxed">
                                You must be at least 18 years old and hold a valid government-issued ID to use LoopLane. Riders must
                                possess a valid driver's license, vehicle registration certificate, and active vehicle insurance. All
                                documents are subject to verification by our team before ride posting privileges are granted.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. User Accounts</h2>
                            <p className="text-gray-600 leading-relaxed">
                                You are responsible for maintaining the confidentiality of your account credentials. You agree to
                                provide accurate, current, and complete information during registration. LoopLane reserves the right
                                to suspend or terminate accounts that provide false information or violate these terms.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Rider Responsibilities</h2>
                            <ul className="list-disc list-inside text-gray-600 space-y-2">
                                <li>Maintain a valid driver's license and ensure the vehicle is roadworthy</li>
                                <li>Follow all traffic laws and regulations</li>
                                <li>Provide accurate ride details including route, timing, and available seats</li>
                                <li>Arrive at the specified pickup location on time</li>
                                <li>Maintain a safe and clean vehicle environment</li>
                                <li>Not operate the vehicle under the influence of alcohol or substances</li>
                                <li>Share the cost of the journey fairly — LoopLane is a cost-sharing platform, not a commercial taxi service</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Passenger Responsibilities</h2>
                            <ul className="list-disc list-inside text-gray-600 space-y-2">
                                <li>Be at the pickup location at the agreed time</li>
                                <li>Respect the rider's vehicle and personal space</li>
                                <li>Complete payment promptly as agreed</li>
                                <li>Follow the rider's reasonable instructions regarding safety</li>
                                <li>Not carry prohibited items (weapons, illegal substances, hazardous materials)</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Payments & Contributions</h2>
                            <p className="text-gray-600 leading-relaxed">
                                LoopLane facilitates cost-sharing between riders and passengers. The contribution amount is calculated
                                based on distance, fuel costs, and number of passengers sharing the ride. LoopLane charges a platform
                                service fee (commission) on each completed ride. Riders receive their earnings after the platform fee
                                deduction. All payments must be completed through the platform's accepted payment methods.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Cancellation Policy</h2>
                            <p className="text-gray-600 leading-relaxed">
                                Both riders and passengers may cancel a booking. Frequent cancellations may result in reduced visibility
                                or temporary account restrictions. Riders who cancel after passengers have confirmed may be subject to
                                cancellation penalties. Refunds for cancelled rides are processed according to our refund policy.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Safety & Security</h2>
                            <p className="text-gray-600 leading-relaxed">
                                LoopLane provides safety features including OTP-based pickup/dropoff verification, SOS emergency alerts,
                                live ride tracking, and driver verification. However, LoopLane does not guarantee the safety of any ride.
                                Users are encouraged to share ride details with trusted contacts, use the in-app emergency features, and
                                report any safety concerns immediately.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Prohibited Conduct</h2>
                            <ul className="list-disc list-inside text-gray-600 space-y-2">
                                <li>Harassment, discrimination, or threatening behavior</li>
                                <li>Using the platform for commercial transportation services</li>
                                <li>Creating multiple accounts or using false identities</li>
                                <li>Manipulating ratings or reviews</li>
                                <li>Sharing account credentials with third parties</li>
                                <li>Attempting to circumvent the platform's payment system</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Intellectual Property</h2>
                            <p className="text-gray-600 leading-relaxed">
                                All content, features, and functionality of the LoopLane platform are owned by LoopLane and are
                                protected by copyright, trademark, and other intellectual property laws. Users may not copy, modify,
                                distribute, or reverse-engineer any part of the platform.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">11. Limitation of Liability</h2>
                            <p className="text-gray-600 leading-relaxed">
                                LoopLane acts solely as a technology platform connecting riders and passengers. We are not a transportation
                                company and do not provide rides. LoopLane is not liable for any damages, injuries, or losses arising from
                                rides facilitated through the platform. Users participate at their own risk.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">12. Dispute Resolution</h2>
                            <p className="text-gray-600 leading-relaxed">
                                Any disputes between users should first be reported through the platform's built-in report system.
                                LoopLane will review reported issues and may take actions including warnings, temporary suspensions,
                                or permanent bans. For unresolved disputes, users agree to binding arbitration under applicable laws.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">13. Modifications</h2>
                            <p className="text-gray-600 leading-relaxed">
                                LoopLane reserves the right to modify these terms at any time. Users will be notified of significant
                                changes via email or in-app notification. Continued use of the platform after changes constitutes
                                acceptance of the modified terms.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-800 mb-3">14. Contact Us</h2>
                            <p className="text-gray-600 leading-relaxed">
                                If you have any questions about these Terms of Service, please contact us at{' '}
                                <a href="mailto:legal@looplane.in" className="text-emerald-600 hover:underline">legal@looplane.in</a>{' '}
                                or visit our <Link to="/support" className="text-emerald-600 hover:underline">Support page</Link>.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default TermsOfService;
