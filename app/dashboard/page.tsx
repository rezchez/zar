'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import pb from '@/lib/pb'; // مطمئن شوید مسیر import فایل pb.ts درست است
import { LogOut, LayoutDashboard, Loader2 } from 'lucide-react';

export default function DashboardPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // بررسی لاگین بودن کاربر
        if (!pb.authStore.isValid) {
            router.push('/');
        } else {
            setIsLoading(false);
        }
    }, [router]);

    const handleLogout = () => {
        pb.authStore.clear();
        router.push('/');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12 font-[Vazirmatn]" dir="rtl">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header داشبورد */}
                <header className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-3 rounded-xl">
                            <LayoutDashboard className="text-indigo-600 w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-800">داشبورد Zarfolio</h1>
                            <p className="text-sm text-gray-500">خوش آمدید، شما با موفقیت وارد شدید.</p>
                        </div>
                    </div>
                    
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-5 py-2.5 rounded-xl transition-colors font-medium"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>خروج</span>
                    </button>
                </header>

                {/* محتوای داشبورد */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 md:col-span-2">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">آمار کلی</h2>
                        <div className="h-40 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400">
                            بخش نمودارها و آمار در اینجا قرار می‌گیرد
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">اطلاعات حساب</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500">وضعیت:</span>
                                <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-md text-sm">فعال</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-2">
                                <span className="text-gray-500">آیدی کاربر:</span>
                                <span className="text-gray-800 text-sm font-mono truncate max-w-[120px]">{pb.authStore.model?.id}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
