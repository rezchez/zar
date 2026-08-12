'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import pb from '@/lib/pb';
import { motion } from 'framer-motion';
import { Lock, User, LogIn, Loader2, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    // اگر کاربر از قبل لاگین بود، مستقیم برود به داشبورد
    useEffect(() => {
        if (pb.authStore.isValid) {
            router.push('/dashboard');
        } else {
            setIsCheckingAuth(false);
        }
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        try {
            await pb.collection('users').authWithPassword(username, password);
            router.push('/dashboard');
        } catch (err) {
            setError('نام کاربری یا رمز عبور اشتباه است.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isCheckingAuth) {
        return null; // در حال بررسی وضعیت ورود اولیه
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-indigo-50 to-blue-100 p-4 font-[Vazirmatn]" dir="rtl">
            {/* دایره های پس زمینه برای زیبایی */}
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md relative z-10"
            >
                <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/60 p-8 sm:p-10">
                    <div className="text-center mb-10">
                        <div className="mx-auto bg-gradient-to-tr from-indigo-600 to-blue-500 w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-indigo-200 transform rotate-3">
                            <ShieldCheck className="text-white w-8 h-8 transform -rotate-3" />
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-800 mb-2">ورود به سیستم</h1>
                        <p className="text-slate-500 text-sm">برای دسترسی به پنل مدیریت Zarfolio وارد شوید</p>
                    </div>

                    {error && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} 
                            animate={{ opacity: 1, scale: 1 }} 
                            className="bg-red-50 text-red-600 text-sm p-4 rounded-xl mb-6 border border-red-100 flex items-center gap-2"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>
                            {error}
                        </motion.div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">نام کاربری یا ایمیل</label>
                            <div className="relative flex items-center">
                                <User className="absolute right-4 text-slate-400 w-5 h-5" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-white/50 border border-slate-200 text-slate-800 rounded-xl pr-12 pl-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                                    placeholder="admin@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">رمز عبور</label>
                            <div className="relative flex items-center">
                                <Lock className="absolute right-4 text-slate-400 w-5 h-5" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/50 border border-slate-200 text-slate-800 rounded-xl pr-12 pl-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-xl py-4 px-4 font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-900/20 disabled:opacity-70 disabled:cursor-not-allowed group mt-2"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                    <span>ورود به حساب</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
