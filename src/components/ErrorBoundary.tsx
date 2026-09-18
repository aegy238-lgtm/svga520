import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public handleReset = () => {
    const isChunkError = this.state.error?.message && (
      this.state.error.message.includes('Failed to fetch dynamically imported module') ||
      this.state.error.message.includes('dynamically imported module') ||
      this.state.error.message.includes('Loading chunk') ||
      this.state.error.message.includes('error loading')
    );

    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch {
        if (typeof window !== 'undefined') window.location.reload();
      }
    } else if (isChunkError || typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message && (
        this.state.error.message.includes('Failed to fetch dynamically imported module') ||
        this.state.error.message.includes('dynamically imported module') ||
        this.state.error.message.includes('Loading chunk')
      );

      return (
        <div className="w-full min-h-[400px] flex flex-col items-center justify-center p-8 bg-[#0D1017] rounded-3xl border border-red-500/20 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-lg font-black text-white">
              {this.props.fallbackTitle || 'حدث خطأ غير متوقع'}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {isChunkError 
                ? 'تم تحديث أجزاء من المنصة في الخلفية. يرجى النقر على الزر أدناه لتحديث الصفحة واستعادة العمل فوراً.' 
                : (this.state.error?.message || 'تم تفادي توقف التطبيق، يمكنك المحاولة مجدداً.')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة المحاولة والتحميل</span>
            </button>
            {isChunkError && (
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                تحديث كامل للصفحة
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
