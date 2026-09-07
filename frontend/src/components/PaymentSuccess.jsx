import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function PaymentSuccess({ onComplete }) {
    const { token } = useAuth();
    const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'failed'
    const [message, setMessage] = useState('Verifying your payment with Chapa...');

    useEffect(() => {
        const verifyTransaction = async () => {
            const params = new URLSearchParams(window.location.search);
            const tx_ref = params.get('tx_ref');

            if (!tx_ref) {
                setStatus('failed');
                setMessage('No transaction reference found in URL.');
                return;
            }

            try {
                const response = await axios.get(`${API_BASE_URL}/api/payments/chapa/verify/${tx_ref}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                if (response.data.success) {
                    setStatus('success');
                    setMessage('Payment Successful! Your wallet has been credited.');
                    // Automatically clean up the URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                } else {
                    setStatus('failed');
                    setMessage(response.data.message || 'Payment failed or was cancelled.');
                }
            } catch (error) {
                setStatus('failed');
                setMessage(error.response?.data?.message || 'Error verifying payment with server.');
            }
        };

        verifyTransaction();
    }, [token]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 w-full text-center">
            <div className="glass-card border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6">
                
                <div className="flex justify-center">
                    {status === 'verifying' && (
                        <div className="h-20 w-20 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse">
                            <Loader2 size={40} className="animate-spin" />
                        </div>
                    )}
                    
                    {status === 'success' && (
                        <div className="h-20 w-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-fadeIn">
                            <CheckCircle2 size={48} />
                        </div>
                    )}
                    
                    {status === 'failed' && (
                        <div className="h-20 w-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-400 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-fadeIn">
                            <XCircle size={48} />
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="text-xl font-black text-white tracking-tight mb-2">
                        {status === 'verifying' ? 'Processing...' : 
                         status === 'success' ? 'Top-Up Complete!' : 
                         'Payment Failed'}
                    </h3>
                    <p className="text-sm text-gray-400">
                        {message}
                    </p>
                </div>

                <div className="pt-2">
                    <button
                        onClick={onComplete}
                        disabled={status === 'verifying'}
                        className="w-full glass-button hover:bg-neutral-800 text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {status === 'verifying' ? 'Please wait...' : 
                         <>
                            <ArrowLeft size={16} /> Return to Dashboard
                         </>}
                    </button>
                </div>

            </div>
        </div>
    );
}
